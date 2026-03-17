import { Router, type IRouter } from "express";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/chat", (req, res) => {
  const parsed = SendMessageBody.parse(req.body);
  const data = SendMessageResponse.parse({
    reply: `You said: "${parsed.message}". This is a simple echo response.`,
    timestamp: new Date().toISOString(),
  });
  res.json(data);
});

export default router;
