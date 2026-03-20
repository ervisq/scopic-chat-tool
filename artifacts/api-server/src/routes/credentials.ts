import { Router, type IRouter } from "express";
import {
  listUserConnections,
  getUserCredentials,
  saveUserCredentials,
  deleteUserCredentials,
} from "../lib/credential-store";
import { getAuthUser } from "../middlewares/auth";

const VALID_PROVIDERS = ["jira", "zoho", "sts"];

const router: IRouter = Router();

router.get("/credentials", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const connections = await listUserConnections(userId);
    res.json({ connections });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Credentials fetch error:", msg);
    res.status(500).json({ message: "Failed to fetch credentials" });
  }
});

router.post("/credentials/:provider", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Credentials save error:", msg);
    res.status(500).json({ message: "Failed to save credentials" });
  }
});

router.post("/credentials/:provider/modules", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const provider = req.params.provider.toLowerCase();

    if (!VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ message: `Invalid provider. Supported: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }

    const ALLOWED_MODULES: Record<string, string[]> = {
      zoho: ["people", "crm"],
    };

    const { modules } = req.body;
    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      res.status(400).json({ message: "At least one module must be selected" });
      return;
    }

    const allowedForProvider = ALLOWED_MODULES[provider];
    if (allowedForProvider) {
      const invalid = modules.filter((m: string) => !allowedForProvider.includes(m));
      if (invalid.length > 0) {
        res.status(400).json({ message: `Invalid modules: ${invalid.join(", ")}. Allowed: ${allowedForProvider.join(", ")}` });
        return;
      }
    }

    const existing = await getUserCredentials(userId, provider);
    if (!existing) {
      res.status(400).json({ message: `${provider} is not connected. Please connect first.` });
      return;
    }

    const updatedCredentials = {
      ...existing.credentials,
      modules: modules.join(","),
    };

    await saveUserCredentials(userId, provider, updatedCredentials, existing.instanceUrl);

    res.json({ success: true, provider, modules });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Module update error:", msg);
    res.status(500).json({ message: "Failed to update modules" });
  }
});

router.delete("/credentials/:provider", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const provider = req.params.provider.toLowerCase();

    if (!VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ message: `Invalid provider. Supported: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }

    await deleteUserCredentials(userId, provider);

    res.json({ success: true, provider, connected: false });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Credentials delete error:", msg);
    res.status(500).json({ message: "Failed to remove credentials" });
  }
});

export default router;
