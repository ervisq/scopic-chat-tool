import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { routeToolCommand } from "../lib/tool-handlers";
import { routeWithAI, formatToolResponse, getGeneralResponse } from "../services/aiService";
import type { ChatHistoryEntry } from "../services/aiService";
import { trackUsage } from "../lib/usage-tracker";
import { getAuthUser } from "../middlewares/auth";

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

    // Tool selection is delegated entirely to the LLM router (no keyword/regex
    // matching). It either picks a query_* tool, calls report_unsupported, or
    // returns null for genuine general conversation.
    const toolCall = await routeWithAI(parsed.message, history);

    let reply: string;
    let toolCommand: { tool: string; query: string } | undefined;

    if (toolCall && toolCall.functionName === "report_unsupported") {
      const reason = typeof toolCall.args.reason === "string" ? toolCall.args.reason : "";
      console.log("[Chat] LLM reported unsupported request:", reason || "(no reason)");
      trackUsage(authUser.email, null, parsed.message);
      reply =
        "I can only read data from the connected apps (JIRA, Teamwork, Outlook, STS, and Zoho) — and only read, never change anything. I couldn't map your request to a specific app and action" +
        (reason ? ` (${reason})` : "") +
        '. Try naming the app and what you want to see, e.g. "my open Teamwork tasks" or "JIRA bugs assigned to me".';
    } else if (toolCall) {
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
