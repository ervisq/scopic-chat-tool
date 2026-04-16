import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { routeToolCommand } from "../lib/tool-handlers";
import { routeWithAI, formatToolResponse, getGeneralResponse } from "../services/aiService";
import type { ChatHistoryEntry } from "../services/aiService";
import { trackUsage } from "../lib/usage-tracker";
import { getAuthUser } from "../middlewares/auth";
import { parseToolCommand } from "../lib/parse-tool-command";

const router: IRouter = Router();

const MAX_TOOL_DATA_CHARS = 8000;
const FORMAT_TIMEOUT_MS = 25000;

function truncateToolData(data: string): string {
  if (data.length <= MAX_TOOL_DATA_CHARS) return data;

  const lines = data.split("\n");
  let truncated = "";
  let lineCount = 0;

  for (const line of lines) {
    if (truncated.length + line.length + 1 > MAX_TOOL_DATA_CHARS) break;
    truncated += (lineCount > 0 ? "\n" : "") + line;
    lineCount++;
  }

  const totalLines = lines.length;
  const remainingLines = totalLines - lineCount;
  if (remainingLines > 0) {
    truncated += `\n\n... and ${remainingLines} more lines (${data.length - truncated.length} more characters). Showing first ${lineCount} of ${totalLines} lines.`;
  }

  return truncated;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

router.post("/chat", async (req, res) => {
  try {
    const parsed = SendMessageBody.parse(req.body);
    const authUser = getAuthUser(req);

    console.log("[Chat] Incoming message:", JSON.stringify(parsed.message));

    const history: ChatHistoryEntry[] = (parsed.history || [])
      .slice(-20)
      .map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));

    const explicitTool = parseToolCommand(parsed.message);

    let toolCall = await routeWithAI(parsed.message, history);

    if (explicitTool && (!toolCall || toolCall.toolName.toLowerCase() !== explicitTool.tool.toLowerCase())) {
      console.log(`[Chat] @-mention override: AI picked "${toolCall?.toolName || 'none'}" but user explicitly mentioned @${explicitTool.tool} — forcing correct tool`);
      const query = parsed.message.replace(/@[a-zA-Z0-9_-]+/g, "").trim() || parsed.message;
      const overrideArgs: Record<string, unknown> = { query, _atMentionOverride: true };

      // Carry over date / filter intent that the AI router already extracted
      // from the user's natural-language query, so @-mention doesn't erase
      // things like "today", "this week", "my", or a specific entity name.
      // Only tool-agnostic fields are copied unconditionally; tool-specific
      // fields like `module` are only copied when the AI originally routed to
      // the same tool, to avoid cross-tool contamination (e.g. a Recruit
      // module leaking into a CRM query).
      if (toolCall?.args && typeof toolCall.args === "object") {
        const prev = toolCall.args as Record<string, unknown>;
        const sameTool = toolCall.toolName.toLowerCase() === explicitTool.tool.toLowerCase();
        const crossToolKeys = [
          "date_field",
          "date_range_start",
          "date_range_end",
          "owner_filter",
          "search_entity",
        ];
        const sameToolOnlyKeys = ["status_filter", "module"];
        for (const key of crossToolKeys) {
          if (prev[key] !== undefined && overrideArgs[key] === undefined) {
            overrideArgs[key] = prev[key];
          }
        }
        if (sameTool) {
          for (const key of sameToolOnlyKeys) {
            if (prev[key] !== undefined && overrideArgs[key] === undefined) {
              overrideArgs[key] = prev[key];
            }
          }
        }
      }

      if (explicitTool.tool === "ZohoCRM") {
        const lowerQuery = query.toLowerCase();
        const hasModuleIntent = /\b(tasks?|deals?|leads?|contacts?|accounts?|events?|calls?|products?|quotes?|invoices?|campaigns?|vendors?|my )\b/.test(lowerQuery);
        if (!hasModuleIntent && overrideArgs.module === undefined) {
          overrideArgs.module = "accounts";
          overrideArgs.include_related = true;
        }
      }
      toolCall = {
        toolName: explicitTool.tool,
        functionName: `query_${explicitTool.tool.toLowerCase()}`,
        args: overrideArgs,
      };
    }

    let reply: string;
    let toolCommand: { tool: string; query: string } | undefined;

    if (toolCall) {
      console.log("[Chat] AI selected tool:", toolCall.toolName, "with args:", JSON.stringify(toolCall.args));
      trackUsage(authUser.email, toolCall.toolName, parsed.message);

      toolCommand = { tool: toolCall.toolName, query: parsed.message };

      const toolResult = await routeToolCommand(toolCall.toolName, toolCall.args, authUser.userId);
      console.log("[Chat] Tool result length:", toolResult.reply.length, "chars");

      const dataForFormatting = truncateToolData(toolResult.reply);
      if (dataForFormatting.length < toolResult.reply.length) {
        console.log(`[Chat] Truncated tool data for AI formatting: ${toolResult.reply.length} → ${dataForFormatting.length} chars`);
      }

      try {
        reply = await withTimeout(
          formatToolResponse(parsed.message, toolCall.toolName, dataForFormatting, history),
          FORMAT_TIMEOUT_MS,
          "AI formatting",
        );
      } catch (aiErr) {
        console.error("[Chat] AI formatting error, falling back to raw data:", aiErr instanceof Error ? aiErr.message : aiErr);
        reply = toolResult.reply;
      }
    } else {
      console.log("[Chat] No tool needed — general conversation");
      trackUsage(authUser.email, null, parsed.message);
      reply = await getGeneralResponse(parsed.message, history);
    }

    const data = SendMessageResponse.parse({
      reply,
      timestamp: new Date().toISOString(),
      ...(toolCommand ? { toolCommand } : {}),
    });

    console.log("[Chat] Response sent to client, reply length:", reply.length, "chars");
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Chat] Error:", msg);
    res.status(500).json({ message: "Failed to process your message. Please try again." });
  }
});

export default router;
