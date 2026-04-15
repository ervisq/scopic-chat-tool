import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { routeToolCommand } from "../lib/tool-handlers";
import { routeWithAI, formatToolResponse, getGeneralResponse } from "../services/aiService";
import type { ChatHistoryEntry } from "../services/aiService";
import { trackUsage } from "../lib/usage-tracker";
import { getAuthUser } from "../middlewares/auth";
import { parseToolCommand } from "../lib/parse-tool-command";

const router: IRouter = Router();

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
      if (explicitTool.tool === "ZohoCRM") {
        const lowerQuery = query.toLowerCase();
        const hasModuleIntent = /\b(tasks?|deals?|leads?|contacts?|accounts?|events?|calls?|products?|quotes?|invoices?|campaigns?|vendors?|my )\b/.test(lowerQuery);
        if (!hasModuleIntent) {
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

      try {
        reply = await formatToolResponse(parsed.message, toolCall.toolName, toolResult.reply, history);
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

    console.log("[Chat] Response sent to client");
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Chat] Error:", msg);
    res.status(500).json({ message: "Failed to process your message. Please try again." });
  }
});

export default router;
