import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { listUserConnections, getUserCredentials } from "../lib/credential-store";
import { queryJira } from "../services/jiraService";
import { queryZohoPeople } from "../services/zohoPeopleService";
import { queryZohoCrm } from "../services/zohoCrmService";
import { querySts } from "../services/stsService";

const router: IRouter = Router();

interface ServiceSummary {
  key: string;
  name: string;
  connected: boolean;
  instanceUrl?: string | null;
  summary?: Record<string, unknown>;
  error?: string;
}

async function getZohoTokens(userId: number) {
  const cred = await getUserCredentials(userId, "zoho");
  if (!cred) return null;
  const { refreshToken } = cred.credentials;
  const clientId = process.env.ZOHO_CLIENT_ID || "";
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { refreshToken, clientId, clientSecret };
}

router.get("/dashboard", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const connections = await listUserConnections(userId);

    const connMap = new Map(connections.map((c) => [c.provider, c]));

    const services: ServiceSummary[] = [];
    const promises: Promise<void>[] = [];

    const jiraConn = connMap.get("jira");
    if (jiraConn) {
      promises.push(
        (async () => {
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
          } catch {
            services.push({
              key: "jira",
              name: "JIRA",
              connected: true,
              instanceUrl: jiraConn.instanceUrl,
              error: "Could not load Jira data",
            });
          }
        })(),
      );
    } else {
      services.push({ key: "jira", name: "JIRA", connected: false });
    }

    const zohoConn = connMap.get("zoho");
    if (zohoConn) {
      promises.push(
        (async () => {
          try {
            const tokens = await getZohoTokens(userId);
            if (!tokens) {
              services.push({
                key: "zoho_people",
                name: "Zoho People",
                connected: true,
                summary: { status: "Reconnect needed — token expired" },
              });
              return;
            }
            const result = await queryZohoPeople(
              "headcount",
              tokens.clientId,
              tokens.clientSecret,
              tokens.refreshToken,
              "https://accounts.zoho.com",
            );
            services.push({
              key: "zoho_people",
              name: "Zoho People",
              connected: true,
              summary: {
                status: `${result.total} employee${result.total !== 1 ? "s" : ""} in directory`,
                employeeCount: result.total,
              },
            });
          } catch {
            services.push({
              key: "zoho_people",
              name: "Zoho People",
              connected: true,
              summary: { status: "Connected" },
            });
          }
        })(),
      );

      promises.push(
        (async () => {
          try {
            const tokens = await getZohoTokens(userId);
            if (!tokens) {
              services.push({
                key: "zoho_crm",
                name: "Zoho CRM",
                connected: true,
                summary: { status: "Reconnect needed — token expired" },
              });
              return;
            }
            const result = await queryZohoCrm(
              "leads",
              tokens.clientId,
              tokens.clientSecret,
              tokens.refreshToken,
              "https://accounts.zoho.com",
            );
            const totalLeads = result.total ?? 0;
            services.push({
              key: "zoho_crm",
              name: "Zoho CRM",
              connected: true,
              summary: {
                status: `${totalLeads} lead${totalLeads !== 1 ? "s" : ""} in pipeline`,
                leadCount: totalLeads,
              },
            });
          } catch {
            services.push({
              key: "zoho_crm",
              name: "Zoho CRM",
              connected: true,
              summary: { status: "Connected" },
            });
          }
        })(),
      );
    } else {
      services.push({ key: "zoho_people", name: "Zoho People", connected: false });
      services.push({ key: "zoho_crm", name: "Zoho CRM", connected: false });
    }

    const stsConn = connMap.get("sts");
    if (stsConn) {
      promises.push(
        (async () => {
          try {
            const result = await querySts("status", userId);
            const serviceCount = result.services.length;
            const healthyCount = result.services.filter((s) => s.status === "Healthy").length;
            services.push({
              key: "sts",
              name: "STS",
              connected: true,
              instanceUrl: stsConn.instanceUrl,
              summary: {
                status: `${healthyCount}/${serviceCount} services healthy`,
                overallHealth: result.overallHealth,
                serviceCount,
                healthyCount,
              },
            });
          } catch {
            services.push({
              key: "sts",
              name: "STS",
              connected: true,
              instanceUrl: stsConn.instanceUrl,
              summary: { status: "Connected" },
            });
          }
        })(),
      );
    } else {
      services.push({ key: "sts", name: "STS", connected: false });
    }

    await Promise.all(promises);

    const order = ["jira", "zoho_people", "zoho_crm", "sts"];
    services.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

    res.json({ services });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Dashboard error:", msg);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

export default router;
