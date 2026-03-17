import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { parseToolCommand } from "../lib/parse-tool-command";
import { routeToolCommand } from "../lib/tool-handlers";
import { getAIResponse } from "../services/aiService";
import { trackUsage, getUsageLog, getUsageStats } from "../lib/usage-tracker";

const router: IRouter = Router();

router.post("/chat", async (req, res) => {
  try {
    const parsed = SendMessageBody.parse(req.body);
    const toolCommand = parseToolCommand(parsed.message);
    const userEmail = (req as any).user?.email || "unknown";

    trackUsage(userEmail, toolCommand?.tool || null, parsed.message);

    let reply: string;
    if (toolCommand) {
      const toolResult = await routeToolCommand(toolCommand.tool, toolCommand.query);
      try {
        reply = await getAIResponse(parsed.message, {
          tool: toolCommand.tool,
          query: toolCommand.query,
          data: toolResult.reply,
        });
      } catch {
        reply = toolResult.reply;
      }
    } else {
      reply = await getAIResponse(parsed.message);
    }

    const data = SendMessageResponse.parse({
      reply,
      timestamp: new Date().toISOString(),
      ...(toolCommand ? { toolCommand } : {}),
    });

    res.json(data);
  } catch (error: any) {
    console.error("Chat error:", error?.message || error);
    res.status(500).json({ message: "Failed to process your message. Please try again." });
  }
});

router.get("/usage", (_req, res) => {
  res.json({ log: getUsageLog(), stats: getUsageStats() });
});

export default router;
