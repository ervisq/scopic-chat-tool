import { Router, type IRouter } from "express";
import {
  listUserConnections,
  saveUserCredentials,
  deleteUserCredentials,
} from "../lib/credential-store";

const VALID_PROVIDERS = ["jira", "zoho", "sts"];

const router: IRouter = Router();

router.get("/credentials", async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const connections = await listUserConnections(userId);
    res.json({ connections });
  } catch (error: any) {
    console.error("Credentials fetch error:", error?.message);
    res.status(500).json({ message: "Failed to fetch credentials" });
  }
});

router.post("/credentials/:provider", async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const provider = req.params.provider.toLowerCase();

    if (!VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ message: `Invalid provider. Supported: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }

    const { credentials, instanceUrl } = req.body;
    if (!credentials || typeof credentials !== "object") {
      res.status(400).json({ message: "Credentials object is required" });
      return;
    }

    await saveUserCredentials(userId, provider, credentials, instanceUrl);

    res.json({ success: true, provider, connected: true });
  } catch (error: any) {
    console.error("Credentials save error:", error?.message);
    res.status(500).json({ message: "Failed to save credentials" });
  }
});

router.delete("/credentials/:provider", async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const provider = req.params.provider.toLowerCase();

    await deleteUserCredentials(userId, provider);

    res.json({ success: true, provider, connected: false });
  } catch (error: any) {
    console.error("Credentials delete error:", error?.message);
    res.status(500).json({ message: "Failed to remove credentials" });
  }
});

export default router;
