import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { parseToolCommand } from "../lib/parse-tool-command";
import { routeToolCommand } from "../lib/tool-handlers";
import { getAIResponse, resolveToolFromHistory } from "../services/aiService";
import type { ChatHistoryEntry } from "../services/aiService";
import { trackUsage } from "../lib/usage-tracker";
import { getAuthUser } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/chat", async (req, res) => {
  try {
    const parsed = SendMessageBody.parse(req.body);
    const authUser = getAuthUser(req);

    const history: ChatHistoryEntry[] = (parsed.history || [])
      .slice(-20)
      .map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));

    let toolCommand = parseToolCommand(parsed.message);

    if (!toolCommand && history.length > 0) {
      try {
        const resolved = await resolveToolFromHistory(parsed.message, history);
        if (resolved) {
          toolCommand = { tool: resolved.tool, query: resolved.query };
        }
      } catch (err) {
        console.error("Tool resolution from history failed:", err);
      }
    }

    trackUsage(authUser.email, toolCommand?.tool || null, parsed.message);

    let reply: string;
    if (toolCommand) {
      const toolResult = await routeToolCommand(toolCommand.tool, toolCommand.query, authUser.userId);
      try {
        reply = await getAIResponse(parsed.message, {
          tool: toolCommand.tool,
          query: toolCommand.query,
          data: toolResult.reply,
        }, history);
      } catch {
        reply = toolResult.reply;
      }
    } else {
      reply = await getAIResponse(parsed.message, undefined, history);
    }

    const data = SendMessageResponse.parse({
      reply,
      timestamp: new Date().toISOString(),
      ...(toolCommand ? { toolCommand } : {}),
    });

    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Chat error:", msg);
    res.status(500).json({ message: "Failed to process your message. Please try again." });
  }
});

export default router;
