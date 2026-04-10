import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { parseToolCommand } from "../lib/parse-tool-command";
import { routeToolCommand } from "../lib/tool-handlers";
import { getAIResponse, resolveToolFromHistory } from "../services/aiService";
import type { ChatHistoryEntry } from "../services/aiService";
import { trackUsage } from "../lib/usage-tracker";
import { getAuthUser } from "../middlewares/auth";
import { isLikelyToolConfirmation } from "../lib/tool-confirmation";

const router: IRouter = Router();

router.post("/chat", async (req, res) => {
  try {
    const parsed = SendMessageBody.parse(req.body);
    const authUser = getAuthUser(req);

    console.log("[Chat] Incoming message:", JSON.stringify(parsed.message));
    console.log("[Chat] History length:", (parsed.history || []).length);

    const history: ChatHistoryEntry[] = (parsed.history || [])
      .slice(-20)
      .map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));

    let toolCommand = parseToolCommand(parsed.message);
    console.log("[Chat] parseToolCommand result:", toolCommand ? JSON.stringify(toolCommand) : "null (no tool detected)");

    if (history.length > 0) {
      if (!toolCommand) {
        console.log("[Chat] No tool matched, trying resolveToolFromHistory via OpenAI...");
        try {
          const resolved = await resolveToolFromHistory(parsed.message, history);
          console.log("[Chat] resolveToolFromHistory result:", resolved ? JSON.stringify(resolved) : "null");
          if (resolved) {
            toolCommand = { tool: resolved.tool, query: resolved.query };
          }
        } catch (err) {
          console.error("[Chat] Tool resolution from history failed:", err);
        }
      } else if (isLikelyToolConfirmation(parsed.message)) {
        console.log("[Chat] Likely tool confirmation, trying resolveToolFromHistory via OpenAI...");
        try {
          const resolved = await resolveToolFromHistory(parsed.message, history);
          console.log("[Chat] resolveToolFromHistory result:", resolved ? JSON.stringify(resolved) : "null");
          if (resolved) {
            toolCommand = { tool: resolved.tool, query: resolved.query };
          }
        } catch (err) {
          console.error("[Chat] Tool resolution from history (confirmation) failed:", err);
        }
      }
    }

    console.log("[Chat] Final tool decision:", toolCommand ? JSON.stringify(toolCommand) : "none (general chat)");
    trackUsage(authUser.email, toolCommand?.tool || null, parsed.message);

    let reply: string;
    if (toolCommand) {
      console.log("[Chat] Routing to tool:", toolCommand.tool, "query:", toolCommand.query);
      const toolResult = await routeToolCommand(toolCommand.tool, toolCommand.query, authUser.userId);
      console.log("[Chat] Tool result length:", toolResult.reply.length, "chars");
      try {
        console.log("[Chat] Sending tool data to OpenAI for formatting...");
        reply = await getAIResponse(parsed.message, {
          tool: toolCommand.tool,
          query: toolCommand.query,
          data: toolResult.reply,
        }, history);
        console.log("[Chat] OpenAI response received, length:", reply.length, "chars");
      } catch (aiErr) {
        console.error("[Chat] OpenAI error:", aiErr instanceof Error ? aiErr.message : aiErr);
        reply = toolResult.reply;
      }
    } else {
      console.log("[Chat] No tool, sending to OpenAI as general chat...");
      reply = await getAIResponse(parsed.message, undefined, history);
      console.log("[Chat] OpenAI response received, length:", reply.length, "chars");
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
