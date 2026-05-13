import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { getCachedDashboard } from "../lib/dashboard-cache";

const router: IRouter = Router();

const ZOHO_SUB_TO_TOOL: Record<string, string> = {
  zoho_people: "ZohoPeople",
  zoho_crm: "ZohoCRM",
  zoho_recruit: "ZohoRecruit",
  zoho_contracts: "ZohoContracts",
};

interface CachedService {
  key?: string;
  accessible?: boolean;
  connected?: boolean;
}

router.get("/tool-access", (req, res) => {
  try {
    const auth = getAuthUser(req);
    const { userId } = auth;

    const access: Record<string, boolean> = {
      ZohoPeople: true,
      ZohoCRM: true,
      ZohoRecruit: true,
      ZohoContracts: true,
    };

    const cached = getCachedDashboard(userId) as
      | { services?: CachedService[] }
      | null;

    if (cached?.services && Array.isArray(cached.services)) {
      for (const svc of cached.services) {
        if (!svc?.key) continue;
        const toolName = ZOHO_SUB_TO_TOOL[svc.key];
        if (!toolName) continue;
        if (svc.connected === false) {
          access[toolName] = true;
          continue;
        }
        access[toolName] = svc.accessible !== false;
      }
    }

    res.json({ access });
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Failed to read tool access",
    });
  }
});

export default router;
