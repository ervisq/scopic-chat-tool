import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";
import { parseToolCommand } from "../lib/parse-tool-command";
import { routeToolCommand } from "../lib/tool-handlers";

const router: IRouter = Router();

router.post("/chat", (req, res) => {
  const parsed = SendMessageBody.parse(req.body);
  const toolCommand = parseToolCommand(parsed.message);

  let reply: string;
  if (toolCommand) {
    const result = routeToolCommand(toolCommand.tool, toolCommand.query);
    reply = result.reply;
  } else {
    reply = `You said: "${parsed.message}". This is a simple echo response.`;
  }

  const data = SendMessageResponse.parse({
    reply,
    timestamp: new Date().toISOString(),
    ...(toolCommand ? { toolCommand } : {}),
  });

  res.json(data);
});

export default router;
