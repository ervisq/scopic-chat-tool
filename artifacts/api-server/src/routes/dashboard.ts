import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { listUserConnections, getUserCredentials } from "../lib/credential-store";
import { queryJira } from "../services/jiraService";
import { queryZohoPeople } from "../services/zohoPeopleService";
import { queryZohoCrm } from "../services/zohoCrmService";
import { querySts } from "../services/stsService";
import { queryTeamwork } from "../services/teamworkService";
import { getGraphClient, isGraphConfigured } from "../services/microsoftGraphClient";
import { getRecentEmails } from "../services/outlookMailService";
import { getUpcomingEvents } from "../services/outlookCalendarService";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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
            const result = await queryJira("my tasks", userId);
            if (result.source === "error") {
              services.push({
                key: "jira",
                name: "JIRA",
                connected: true,
                instanceUrl: jiraConn.instanceUrl,
                error: "Could not load Jira data — check your credentials",
              });
            } else {
              const openTickets = result.tickets.filter((t) => t.status !== "Done");
              services.push({
                key: "jira",
                name: "JIRA",
                connected: true,
                instanceUrl: jiraConn.instanceUrl,
                summary: {
                  totalTickets: result.total,
                  openTickets: openTickets.length,
                  tickets: result.tickets.map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    project: t.project,
                  })),
                },
              });
            }
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
      const zohoTokens = await getZohoTokens(userId);
      if (!zohoTokens) {
        services.push({
          key: "zoho_people",
          name: "Zoho People",
          connected: true,
          summary: { status: "Reconnect needed — token expired" },
        });
        services.push({
          key: "zoho_crm",
          name: "Zoho CRM",
          connected: true,
          summary: { status: "Reconnect needed — token expired" },
        });
      } else {
        promises.push(
          (async () => {
            try {
              const result = await queryZohoPeople(
                "headcount",
                zohoTokens.clientId,
                zohoTokens.clientSecret,
                zohoTokens.refreshToken,
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
              const result = await queryZohoCrm(
                "leads",
                zohoTokens.clientId,
                zohoTokens.clientSecret,
                zohoTokens.refreshToken,
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
      }
    } else {
      services.push({ key: "zoho_people", name: "Zoho People", connected: false });
      services.push({ key: "zoho_crm", name: "Zoho CRM", connected: false });
    }

    const stsConn = connMap.get("sts");
    if (stsConn) {
      promises.push(
        (async () => {
          try {
            const result = await querySts("my hours this week", userId);
            if (result.source === "error") {
              services.push({
                key: "sts",
                name: "STS",
                connected: true,
                instanceUrl: stsConn.instanceUrl,
                error: result.errorMessage || "Could not load STS data — check your token",
              });
            } else {
              const daysSummary = result.byDay
                .filter((d) => d.hours > 0)
                .map((d) => `${d.dayName.slice(0, 3)}: ${d.hours.toFixed(1)}h`)
                .join(", ");
              services.push({
                key: "sts",
                name: "STS",
                connected: true,
                instanceUrl: stsConn.instanceUrl,
                summary: {
                  status: `${result.totalHours}h logged this week`,
                  totalHours: result.totalHours,
                  weekStart: result.weekStart,
                  weekEnd: result.weekEnd,
                  daysSummary: daysSummary || "No hours logged yet",
                  byProject: result.byProject.map((p) => ({
                    name: p.projectName,
                    hours: p.hours,
                  })),
                },
              });
            }
          } catch (err: unknown) {
            console.error("[Dashboard] STS fetch error:", err instanceof Error ? err.message : String(err));
            services.push({
              key: "sts",
              name: "STS",
              connected: true,
              instanceUrl: stsConn.instanceUrl,
              error: "Could not load STS data — check your token or try again later",
            });
          }
        })(),
      );
    } else {
      services.push({ key: "sts", name: "STS", connected: false });
    }

    const teamworkConn = connMap.get("teamwork");
    if (teamworkConn) {
      promises.push(
        (async () => {
          try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateFilter = thirtyDaysAgo.toISOString().split("T")[0];
            const result = await queryTeamwork(`my latest tasks due after ${dateFilter}`, userId);
            if (result.source === "error") {
              services.push({
                key: "teamwork",
                name: "Teamwork",
                connected: true,
                instanceUrl: teamworkConn.instanceUrl,
                error: "Could not load Teamwork data — check your credentials",
              });
            } else {
              const tasks = result.data as { id: number; name: string; status: string; priority: string; projectName: string }[];
              const activeTasks = tasks.filter((t) => t.status.toLowerCase() !== "completed");
              services.push({
                key: "teamwork",
                name: "Teamwork",
                connected: true,
                instanceUrl: teamworkConn.instanceUrl,
                summary: {
                  totalTasks: result.total,
                  activeTasks: activeTasks.length,
                  status: `${activeTasks.length} active task${activeTasks.length !== 1 ? "s" : ""}`,
                  tasks: tasks.map((t) => ({
                    id: t.id,
                    title: t.name,
                    status: t.status,
                    priority: t.priority,
                    projectName: t.projectName,
                  })),
                },
              });
            }
          } catch {
            services.push({
              key: "teamwork",
              name: "Teamwork",
              connected: true,
              instanceUrl: teamworkConn.instanceUrl,
              error: "Could not load Teamwork data",
            });
          }
        })(),
      );
    } else {
      services.push({ key: "teamwork", name: "Teamwork", connected: false });
    }

    if (isGraphConfigured()) {
      const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      const userEmail = userRow?.email;

      if (userEmail) {
        const client = getGraphClient();

        promises.push(
          (async () => {
            try {
              const emails = await getRecentEmails(client, userEmail, 5);
              services.push({
                key: "outlook_email",
                name: "Outlook Email",
                connected: true,
                summary: { emails },
              });
            } catch {
              services.push({
                key: "outlook_email",
                name: "Outlook Email",
                connected: true,
                error: "Could not load emails",
              });
            }
          })(),
        );

        promises.push(
          (async () => {
            try {
              const events = await getUpcomingEvents(client, userEmail, 5);
              services.push({
                key: "outlook_calendar",
                name: "Outlook Calendar",
                connected: true,
                summary: { events },
              });
            } catch {
              services.push({
                key: "outlook_calendar",
                name: "Outlook Calendar",
                connected: true,
                error: "Could not load calendar events",
              });
            }
          })(),
        );
      } else {
        services.push({
          key: "outlook_email",
          name: "Outlook Email",
          connected: false,
          summary: { status: "Could not find your email address. Please contact an administrator." },
        });
        services.push({
          key: "outlook_calendar",
          name: "Outlook Calendar",
          connected: false,
          summary: { status: "Could not find your email address. Please contact an administrator." },
        });
      }
    } else {
      services.push({
        key: "outlook_email",
        name: "Outlook Email",
        connected: false,
        summary: { status: "Microsoft Outlook is not configured on this server." },
      });
      services.push({
        key: "outlook_calendar",
        name: "Outlook Calendar",
        connected: false,
        summary: { status: "Microsoft Outlook is not configured on this server." },
      });
    }

    await Promise.all(promises);

    const order = ["outlook_email", "outlook_calendar", "jira", "zoho_people", "zoho_crm", "sts", "teamwork"];
    services.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

    res.json({ services });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Dashboard error:", msg);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

export default router;
