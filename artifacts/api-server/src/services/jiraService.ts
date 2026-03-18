import axios from "axios";
import { getUserCredentials } from "../lib/credential-store";

export interface JiraTicket {
  id: string;
  title: string;
  status: string;
  assignee: string;
  priority: string;
}

export interface JiraServiceResult {
  tickets: JiraTicket[];
  total: number;
  source: "live" | "not_connected" | "error";
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

async function queryJiraLive(query: string, instanceUrl: string, email: string, apiToken: string): Promise<JiraServiceResult> {
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
      fields: ["summary", "status", "assignee", "priority", "issuetype"],
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

  const tickets: JiraTicket[] = issues.map((issue: any) => ({
    id: issue.key,
    title: issue.fields?.summary || "No title",
    status: mapStatus(issue.fields?.status),
    assignee: mapAssignee(issue.fields?.assignee),
    priority: mapPriority(issue.fields?.priority),
  }));

  return { tickets, total: tickets.length, source: "live" };
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

function getMockTickets(): JiraTicket[] {
  return [
    { id: "JIRA-101", title: "Fix login bug", status: "In Progress", assignee: "Alice", priority: "High" },
    { id: "JIRA-102", title: "Update dashboard UI", status: "To Do", assignee: "Bob", priority: "Medium" },
    { id: "JIRA-103", title: "API rate limiting", status: "Done", assignee: "Carol", priority: "High" },
    { id: "JIRA-104", title: "Add unit tests for auth module", status: "To Do", assignee: "Alice", priority: "Low" },
    { id: "JIRA-105", title: "Database migration script", status: "In Progress", assignee: "Dave", priority: "Medium" },
  ];
}

export async function queryJira(query: string, userId?: number): Promise<JiraServiceResult> {
  if (!userId) {
    return { tickets: [], total: 0, source: "not_connected" };
  }

  const cred = await getUserCredentials(userId, "jira");
  if (!cred) {
    return { tickets: [], total: 0, source: "not_connected" };
  }

  const { email, apiToken } = cred.credentials;
  if (!email || !apiToken || !cred.instanceUrl) {
    return { tickets: [], total: 0, source: "not_connected" };
  }

  try {
    return await queryJiraLive(query, cred.instanceUrl, email, apiToken);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Jira API error:", msg);
    return { tickets: [], total: 0, source: "error" };
  }
}

export function formatJiraResult(result: JiraServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your Jira account is not connected. Please go to Connected Services (Settings icon) to link your Jira credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to Jira. Please check your credentials in Connected Services and try again.";
  }
  const lines = result.tickets.map(
    (t) => `• ${t.id}: ${t.title} (${t.status}) — ${t.assignee} [${t.priority}]`,
  );
  return `JIRA tickets (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
