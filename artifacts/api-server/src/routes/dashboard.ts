import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { getUserCredentials, listUserConnections } from "../lib/credential-store";
import { queryJira } from "../services/jiraService";

const router: IRouter = Router();

interface ServiceSummary {
  key: string;
  name: string;
  connected: boolean;
  instanceUrl?: string | null;
  summary?: Record<string, unknown>;
  error?: string;
}

router.get("/dashboard", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const connections = await listUserConnections(userId);

    const connMap = new Map(connections.map((c) => [c.provider, c]));

    const services: ServiceSummary[] = [];

    const jiraConn = connMap.get("jira");
    if (jiraConn) {
      try {
        const result = await queryJira("assignee = currentUser() ORDER BY updated DESC", userId);
        const openTickets = result.tickets.filter((t) => t.status !== "Done");
        services.push({
          key: "jira",
          name: "JIRA",
          connected: true,
          instanceUrl: jiraConn.instanceUrl,
          summary: {
            totalTickets: result.total,
            openTickets: openTickets.length,
            tickets: result.tickets.slice(0, 5).map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
            })),
          },
        });
      } catch (err) {
        services.push({
          key: "jira",
          name: "JIRA",
          connected: true,
          instanceUrl: jiraConn.instanceUrl,
          error: "Could not load Jira data",
        });
      }
    } else {
      services.push({ key: "jira", name: "JIRA", connected: false });
    }

    const zohoConn = connMap.get("zoho");
    if (zohoConn) {
      try {
        const cred = await getUserCredentials(userId, "zoho");
        const hasRefreshToken = !!(cred?.credentials?.refreshToken);
        services.push({
          key: "zoho_people",
          name: "Zoho People",
          connected: hasRefreshToken,
          summary: {
            status: hasRefreshToken ? "Connected" : "Reconnect needed",
          },
        });
        services.push({
          key: "zoho_crm",
          name: "Zoho CRM",
          connected: hasRefreshToken,
          summary: {
            status: hasRefreshToken ? "Connected" : "Reconnect needed",
          },
        });
      } catch {
        services.push({
          key: "zoho_people",
          name: "Zoho People",
          connected: true,
          error: "Could not load Zoho data",
        });
        services.push({
          key: "zoho_crm",
          name: "Zoho CRM",
          connected: true,
          error: "Could not load Zoho data",
        });
      }
    } else {
      services.push({ key: "zoho_people", name: "Zoho People", connected: false });
      services.push({ key: "zoho_crm", name: "Zoho CRM", connected: false });
    }

    const stsConn = connMap.get("sts");
    if (stsConn) {
      services.push({
        key: "sts",
        name: "STS",
        connected: true,
        instanceUrl: stsConn.instanceUrl,
        summary: { status: "Connected" },
      });
    } else {
      services.push({ key: "sts", name: "STS", connected: false });
    }

    res.json({ services });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Dashboard error:", msg);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

export default router;
