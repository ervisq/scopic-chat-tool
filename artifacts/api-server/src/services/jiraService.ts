import axios from "axios";
import { getUserCredentials, saveUserCredentials } from "../lib/credential-store";
import { getJiraAccessToken } from "./jiraTokenManager";

export interface JiraTicket {
  id: string;
  title: string;
  status: string;
  assignee: string;
  priority: string;
  project: string;
}

export interface JiraServiceResult {
  tickets: JiraTicket[];
  total: number;
  source: "live" | "not_connected" | "error";
  instanceUrl?: string | null;
}

function mapPriority(priority: any): string {
  return priority?.name || "None";
}

function mapStatus(status: any): string {
  return status?.name || "Unknown";
}

function mapAssignee(assignee: any): string {
  return assignee?.displayName || "Unassigned";
}

function isValidJiraUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false;
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("172.")) return false;
    if (hostname === "169.254.169.254") return false;
    return true;
  } catch {
    return false;
  }
}

function parseIssues(issues: any[]): JiraTicket[] {
  return issues.map((issue: any) => ({
    id: issue.key,
    title: issue.fields?.summary || "No title",
    status: mapStatus(issue.fields?.status),
    assignee: mapAssignee(issue.fields?.assignee),
    priority: mapPriority(issue.fields?.priority),
    project: issue.fields?.project?.name || issue.fields?.project?.key || "",
  }));
}

async function queryJiraOAuth(query: string, cloudId: string, refreshToken: string, userId: number, instanceUrl: string | null): Promise<JiraServiceResult> {
  const clientId = process.env.JIRA_CLIENT_ID || "";
  const clientSecret = process.env.JIRA_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error("Jira OAuth is not configured on this server");
  }

  const tokenResult = await getJiraAccessToken(clientId, clientSecret, refreshToken);

  if (tokenResult.newRefreshToken) {
    await saveUserCredentials(userId, "jira", {
      refreshToken: tokenResult.newRefreshToken,
      cloudId,
      authType: "oauth",
    }, instanceUrl);
  }

  const accessToken = tokenResult.accessToken;
  const jql = buildJql(query);

  const response = await axios.post(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
    {
      jql,
      maxResults: 20,
      fields: ["summary", "status", "assignee", "priority", "issuetype", "project"],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  );

  const issues = response.data?.issues || [];
  const tickets = parseIssues(issues);
  return { tickets, total: tickets.length, source: "live", instanceUrl };
}

async function queryJiraBasicAuth(query: string, instanceUrl: string, email: string, apiToken: string): Promise<JiraServiceResult> {
  if (!isValidJiraUrl(instanceUrl)) {
    throw new Error("Invalid Jira instance URL");
  }
  const baseUrl = instanceUrl.replace(/\/$/, "");
  const jql = buildJql(query);

  const response = await axios.post(
    `${baseUrl}/rest/api/3/search/jql`,
    {
      jql,
      maxResults: 20,
      fields: ["summary", "status", "assignee", "priority", "issuetype", "project"],
    },
    {
      auth: {
        username: email,
        password: apiToken,
      },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  );

  const issues = response.data?.issues || [];
  const tickets = parseIssues(issues);
  return { tickets, total: tickets.length, source: "live", instanceUrl };
}

function buildJql(query: string): string {
  const lower = query.toLowerCase();

  if (lower.includes("my") || lower.includes("assigned to me")) {
    return "assignee = currentUser() ORDER BY updated DESC";
  }
  if (lower.includes("open") || lower.includes("active")) {
    return "status != Done ORDER BY updated DESC";
  }
  if (lower.includes("done") || lower.includes("completed") || lower.includes("closed")) {
    return "status = Done ORDER BY updated DESC";
  }
  if (lower.includes("in progress")) {
    return 'status = "In Progress" ORDER BY updated DESC';
  }
  if (lower.includes("high priority") || lower.includes("urgent")) {
    return "priority in (High, Highest) ORDER BY updated DESC";
  }

  return `text ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
}

export async function queryJira(query: string, userId?: number): Promise<JiraServiceResult> {
  if (!userId) {
    return { tickets: [], total: 0, source: "not_connected" };
  }

  const cred = await getUserCredentials(userId, "jira");
  if (!cred) {
    return { tickets: [], total: 0, source: "not_connected" };
  }

  const { refreshToken, cloudId, authType, email, apiToken } = cred.credentials;

  if (authType === "oauth" && refreshToken && cloudId) {
    try {
      return await queryJiraOAuth(query, cloudId, refreshToken, userId, cred.instanceUrl);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Jira OAuth API error:", msg);
      return { tickets: [], total: 0, source: "error" };
    }
  }

  if (email && apiToken && cred.instanceUrl) {
    try {
      return await queryJiraBasicAuth(query, cred.instanceUrl, email, apiToken);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Jira Basic Auth API error:", msg);
      return { tickets: [], total: 0, source: "error" };
    }
  }

  return { tickets: [], total: 0, source: "not_connected" };
}

export function formatJiraResult(result: JiraServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your Jira account is not connected. Please go to Connected Services (Settings icon) to link your Jira credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to Jira. Please check your credentials in Connected Services and try again.";
  }
  const baseUrl = result.instanceUrl ? result.instanceUrl.replace(/\/$/, "") : "";
  const lines = result.tickets.map((t) => {
    const link = baseUrl ? ` ${baseUrl}/browse/${t.id}` : "";
    return `• ${t.id}: ${t.title} (${t.status}) — ${t.assignee} [${t.priority}]${link}`;
  });
  return `JIRA tickets (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
