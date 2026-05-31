import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { getTeamworkTaskDetail } from "../services/teamworkService";
import { getGraphClient, isGraphConfigured } from "../services/microsoftGraphClient";
import { getEmailDetail } from "../services/outlookMailService";

const router: IRouter = Router();

router.get("/details/teamwork/task/:id", async (req, res) => {
  try {
    const auth = getAuthUser(req);
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      res.status(400).json({ message: "Invalid task id" });
      return;
    }

    const result = await getTeamworkTaskDetail(auth.userId, taskId);
    if (result.source === "not_connected") {
      res.status(409).json({ message: "Your Teamwork account is not connected." });
      return;
    }
    if (result.source === "error") {
      res.status(502).json({ message: result.message });
      return;
    }
    res.json(result.detail);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ObjectDetail] Teamwork task error:", msg);
    res.status(500).json({ message: "Failed to load Teamwork task" });
  }
});

router.get("/details/outlook/email", async (req, res) => {
  try {
    const auth = getAuthUser(req);

    if (!isGraphConfigured()) {
      res.status(409).json({ message: "Microsoft Outlook is not configured on this server." });
      return;
    }
    const userEmail = auth.email;
    if (!userEmail) {
      res.status(409).json({ message: "Could not determine your email address." });
      return;
    }

    const messageId = typeof req.query.id === "string" ? req.query.id : "";
    if (!messageId) {
      res.status(400).json({ message: "Missing email id" });
      return;
    }
    // Defense-in-depth: the id is encoded as a single path segment downstream,
    // but reject obviously malformed/abusive ids (control chars, traversal
    // tokens, or implausible length) before issuing any Graph request.
    if (
      messageId.length > 1000 ||
      messageId.includes("..") ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f]/.test(messageId)
    ) {
      res.status(400).json({ message: "Invalid email id" });
      return;
    }

    const client = getGraphClient();
    const detail = await getEmailDetail(client, userEmail, messageId);
    res.json(detail);
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ObjectDetail] Outlook email error:", msg);
    if (status === 404) {
      res.status(404).json({ message: "Email not found" });
      return;
    }
    res.status(500).json({ message: "Failed to load email" });
  }
});

export default router;
