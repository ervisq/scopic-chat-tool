import axios from "axios";
import { getUserCredentials, saveUserCredentials } from "../lib/credential-store";
import { getJiraAccessToken } from "./jiraTokenManager";
import { getCachedNameResolution, setCachedNameResolution } from "../lib/name-resolution-cache";

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
  employeeContext?: string;
  employeeMessage?: string;
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

export interface JiraQueryOptions {
  employee?: string;
  assignee?: string;
}

interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

interface JiraUserSearchResult {
  users: JiraUser[];
  permissionDenied?: boolean;
  lookupFailed?: boolean;
}

async function searchJiraUsers(opts: {
  cloudId?: string;
  accessToken?: string;
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  query: string;
}): Promise<JiraUserSearchResult> {
  const params = { query: opts.query, maxResults: 20 };
  let url: string;
  let config: Record<string, unknown>;
  if (opts.cloudId && opts.accessToken) {
    url = `https://api.atlassian.com/ex/jira/${opts.cloudId}/rest/api/3/user/search`;
    config = {
      params,
      headers: { Authorization: `Bearer ${opts.accessToken}`, Accept: "application/json" },
    };
  } else if (opts.baseUrl && opts.email && opts.apiToken) {
    url = `${opts.baseUrl.replace(/\/$/, "")}/rest/api/3/user/search`;
    config = {
      params,
      auth: { username: opts.email, password: opts.apiToken },
      headers: { Accept: "application/json" },
    };
  } else {
    return { users: [], lookupFailed: true };
  }

  try {
    const response = await axios.get(url, config);
    const data = response.data || [];
    const users = (Array.isArray(data) ? data : []).map((u: any) => ({
      accountId: String(u.accountId || ""),
      displayName: String(u.displayName || ""),
      emailAddress: String(u.emailAddress || ""),
    })).filter((u) => u.accountId);
    return { users };
  } catch (err: unknown) {
    const status = (err as any)?.response?.status;
    console.error("Jira user search failed:", (err as Error).message, "status:", status);
    if (status === 401 || status === 403) {
      return { users: [], permissionDenied: true };
    }
    return { users: [], lookupFailed: true };
  }
}

interface JiraResolvedAssignee {
  accountId?: string;
  displayName?: string;
  ambiguous?: { displayName: string; emailAddress: string }[];
  notFound?: boolean;
  lookupFailed?: boolean;
  permissionDenied?: boolean;
}

async function resolveJiraAssignee(
  term: string,
  authOpts: { cloudId?: string; accessToken?: string; baseUrl?: string; email?: string; apiToken?: string },
  userId?: number,
): Promise<JiraResolvedAssignee> {
  if (userId !== undefined) {
    const cached = getCachedNameResolution<JiraResolvedAssignee>("jira", userId, term);
    if (cached) {
      console.log("[JIRA] name resolution cache hit for", term);
      return cached;
    }
  }
  const { users: matches, permissionDenied, lookupFailed } = await searchJiraUsers({ ...authOpts, query: term });
  if (permissionDenied) return { permissionDenied: true };
  if (lookupFailed) return { lookupFailed: true };

  let result: JiraResolvedAssignee;
  if (matches.length === 0) {
    result = { notFound: true };
  } else {
    // Prefer exact email match if any
    const lowered = term.toLowerCase();
    const exact = matches.find((m) => m.emailAddress.toLowerCase() === lowered);
    if (exact) {
      result = { accountId: exact.accountId, displayName: exact.displayName };
    } else if (matches.length === 1) {
      result = { accountId: matches[0].accountId, displayName: matches[0].displayName };
    } else {
      const nameMatches = matches.filter((m) => m.displayName.toLowerCase().includes(lowered));
      if (nameMatches.length === 1) {
        result = { accountId: nameMatches[0].accountId, displayName: nameMatches[0].displayName };
      } else {
        result = {
          ambiguous: matches.slice(0, 5).map((m) => ({ displayName: m.displayName, emailAddress: m.emailAddress })),
        };
      }
    }
  }

  if (userId !== undefined) {
    setCachedNameResolution("jira", userId, term, result);
  }
  return result;
}

async function queryJiraOAuth(query: string, cloudId: string, refreshToken: string, userId: number, instanceUrl: string | null, opts: JiraQueryOptions): Promise<JiraServiceResult> {
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

  let assigneeAccountId: string | undefined;
  let assigneeContext: string | undefined;
  const employeeTerm = (opts.employee || (opts.assignee && opts.assignee !== "me" && opts.assignee !== "all" && opts.assignee !== "unassigned" ? opts.assignee : undefined))?.trim();
  if (employeeTerm) {
    const resolved = await resolveJiraAssignee(employeeTerm, { cloudId, accessToken }, userId);
    if (resolved.permissionDenied) {
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `Your JIRA account does not have permission to look up users. Ask an admin to grant the "Browse Users" permission.` };
    }
    if (resolved.lookupFailed) {
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `Could not look up "${employeeTerm}" in JIRA. Please try again.` };
    }
    if (resolved.notFound) {
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `No JIRA user matched "${employeeTerm}" — they may not exist or your account may not have access to view them.` };
    }
    if (resolved.ambiguous) {
      const list = resolved.ambiguous.map((m) => `${m.displayName}${m.emailAddress ? ` (${m.emailAddress})` : ""}`).join(", ");
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `Multiple JIRA users matched "${employeeTerm}": ${list}. Please be more specific.` };
    }
    assigneeAccountId = resolved.accountId;
    assigneeContext = resolved.displayName || employeeTerm;
  }

  const jql = buildJql(query, { assigneeAccountId, assigneeMode: opts.assignee });

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
  return { tickets, total: tickets.length, source: "live", instanceUrl, employeeContext: assigneeContext };
}

async function queryJiraBasicAuth(query: string, instanceUrl: string, email: string, apiToken: string, userId: number, opts: JiraQueryOptions): Promise<JiraServiceResult> {
  if (!isValidJiraUrl(instanceUrl)) {
    throw new Error("Invalid Jira instance URL");
  }
  const baseUrl = instanceUrl.replace(/\/$/, "");

  let assigneeAccountId: string | undefined;
  let assigneeContext: string | undefined;
  const employeeTerm = (opts.employee || (opts.assignee && opts.assignee !== "me" && opts.assignee !== "all" && opts.assignee !== "unassigned" ? opts.assignee : undefined))?.trim();
  if (employeeTerm) {
    const resolved = await resolveJiraAssignee(employeeTerm, { baseUrl, email, apiToken }, userId);
    if (resolved.permissionDenied) {
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `Your JIRA account does not have permission to look up users. Ask an admin to grant the "Browse Users" permission.` };
    }
    if (resolved.lookupFailed) {
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `Could not look up "${employeeTerm}" in JIRA. Please try again.` };
    }
    if (resolved.notFound) {
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `No JIRA user matched "${employeeTerm}" — they may not exist or your account may not have access to view them.` };
    }
    if (resolved.ambiguous) {
      const list = resolved.ambiguous.map((m) => `${m.displayName}${m.emailAddress ? ` (${m.emailAddress})` : ""}`).join(", ");
      return { tickets: [], total: 0, source: "live", instanceUrl, employeeMessage: `Multiple JIRA users matched "${employeeTerm}": ${list}. Please be more specific.` };
    }
    assigneeAccountId = resolved.accountId;
    assigneeContext = resolved.displayName || employeeTerm;
  }

  const jql = buildJql(query, { assigneeAccountId, assigneeMode: opts.assignee });

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
  return { tickets, total: tickets.length, source: "live", instanceUrl, employeeContext: assigneeContext };
}

function buildJql(query: string, opts?: { assigneeAccountId?: string; assigneeMode?: string }): string {
  const lower = query.toLowerCase();
  const clauses: string[] = [];

  if (opts?.assigneeAccountId) {
    clauses.push(`assignee = "${opts.assigneeAccountId}"`);
  } else if (opts?.assigneeMode === "me" || lower.includes("my") || lower.includes("assigned to me")) {
    clauses.push("assignee = currentUser()");
  } else if (opts?.assigneeMode === "unassigned") {
    clauses.push("assignee is EMPTY");
  }

  if (lower.includes("done") || lower.includes("completed") || lower.includes("closed")) {
    clauses.push("status = Done");
  } else if (lower.includes("in progress")) {
    clauses.push('status = "In Progress"');
  } else if (lower.includes("open") || lower.includes("active")) {
    clauses.push("status != Done");
  }

  if (lower.includes("high priority") || lower.includes("urgent")) {
    clauses.push("priority in (High, Highest)");
  }

  if (clauses.length === 0) {
    return `text ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
  }
  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

export async function queryJira(query: string, userId?: number, opts?: JiraQueryOptions): Promise<JiraServiceResult> {
  if (!userId) {
    return { tickets: [], total: 0, source: "not_connected" };
  }

  const cred = await getUserCredentials(userId, "jira");
  if (!cred) {
    return { tickets: [], total: 0, source: "not_connected" };
  }

  const { refreshToken, cloudId, authType, email, apiToken } = cred.credentials;
  const queryOpts: JiraQueryOptions = opts || {};

  if (authType === "oauth" && refreshToken && cloudId) {
    try {
      return await queryJiraOAuth(query, cloudId, refreshToken, userId, cred.instanceUrl, queryOpts);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Jira OAuth API error:", msg);
      return { tickets: [], total: 0, source: "error" };
    }
  }

  if (email && apiToken && cred.instanceUrl) {
    try {
      return await queryJiraBasicAuth(query, cred.instanceUrl, email, apiToken, userId, queryOpts);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Jira Basic Auth API error:", msg);
      return { tickets: [], total: 0, source: "error" };
    }
  }

  return { tickets: [], total: 0, source: "not_connected" };
}

export interface JiraIssueDetail {
  issue: {
    id: string;
    summary: string;
    status: string;
    assignee: string;
    priority: string;
    project: string;
    issueType: string;
    description: string;
    reporter: string;
    created: string;
    updated: string;
    dueDate: string;
    labels: string[];
  };
  comments: Array<{ id: string; body: string; author: string; createdAt: string }>;
  instanceUrl: string | null;
}

export type JiraIssueDetailResult =
  | { source: "live"; detail: JiraIssueDetail }
  | { source: "not_connected" }
  | { source: "error"; message: string };

/** Recursively extract plain text from an Atlassian Document Format (ADF) node. */
function extractAdfText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractAdfText).join("");
  let text = "";
  if (typeof node.text === "string") text += node.text;
  if (Array.isArray(node.content)) {
    const inner = node.content.map(extractAdfText).join("");
    const blockTypes = new Set([
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "listItem",
      "blockquote",
      "codeBlock",
    ]);
    text += blockTypes.has(node.type) ? `${inner}\n` : inner;
  }
  return text;
}

function adfToPlainText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return extractAdfText(value).replace(/\n{3,}/g, "\n\n").trim();
}

function mapIssueDetail(issue: any, instanceUrl: string | null): JiraIssueDetail {
  const fields = issue?.fields || {};
  const rawComments = fields.comment?.comments || [];
  return {
    issue: {
      id: issue?.key || "",
      summary: fields.summary || "No title",
      status: mapStatus(fields.status),
      assignee: mapAssignee(fields.assignee),
      priority: mapPriority(fields.priority),
      project: fields.project?.name || fields.project?.key || "",
      issueType: fields.issuetype?.name || "",
      description: adfToPlainText(fields.description),
      reporter: fields.reporter?.displayName || "",
      created: fields.created || "",
      updated: fields.updated || "",
      dueDate: fields.duedate || "",
      labels: Array.isArray(fields.labels) ? fields.labels.map((l: unknown) => String(l)) : [],
    },
    comments: (Array.isArray(rawComments) ? rawComments : []).map((c: any) => ({
      id: String(c?.id || ""),
      body: adfToPlainText(c?.body),
      author: c?.author?.displayName || "Unknown",
      createdAt: c?.created || "",
    })),
    instanceUrl,
  };
}

const ISSUE_DETAIL_FIELDS =
  "summary,status,assignee,priority,project,issuetype,created,updated,duedate,description,reporter,labels,comment";

export async function getJiraIssueDetail(userId: number, issueKey: string): Promise<JiraIssueDetailResult> {
  if (!userId) return { source: "not_connected" };

  const cred = await getUserCredentials(userId, "jira");
  if (!cred) return { source: "not_connected" };

  const { refreshToken, cloudId, authType, email, apiToken } = cred.credentials;

  try {
    if (authType === "oauth" && refreshToken && cloudId) {
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
        }, cred.instanceUrl);
      }
      const response = await axios.get(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
        {
          params: { fields: ISSUE_DETAIL_FIELDS },
          headers: { Authorization: `Bearer ${tokenResult.accessToken}`, Accept: "application/json" },
        },
      );
      return { source: "live", detail: mapIssueDetail(response.data, cred.instanceUrl) };
    }

    if (email && apiToken && cred.instanceUrl) {
      if (!isValidJiraUrl(cred.instanceUrl)) {
        return { source: "error", message: "Invalid Jira instance URL" };
      }
      const baseUrl = cred.instanceUrl.replace(/\/$/, "");
      const response = await axios.get(
        `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
        {
          params: { fields: ISSUE_DETAIL_FIELDS },
          auth: { username: email, password: apiToken },
          headers: { Accept: "application/json" },
        },
      );
      return { source: "live", detail: mapIssueDetail(response.data, cred.instanceUrl) };
    }

    return { source: "not_connected" };
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Jira issue detail error:", msg);
    if (status === 404) {
      return { source: "error", message: "Issue not found" };
    }
    if (status === 401 || status === 403) {
      return { source: "error", message: "Your Jira connection has expired or been revoked. Please reconnect Jira in Connected Services." };
    }
    return { source: "error", message: "Failed to fetch issue from Jira" };
  }
}

export function formatJiraResult(result: JiraServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your Jira account is not connected. Please go to Connected Services (Settings icon) to link your Jira credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to Jira. Please check your credentials in Connected Services and try again.";
  }
  if (result.employeeMessage) {
    return result.employeeMessage;
  }
  const baseUrl = result.instanceUrl ? result.instanceUrl.replace(/\/$/, "") : "";
  if (result.total === 0) {
    if (result.employeeContext) {
      return `No JIRA tickets found for ${result.employeeContext} (query: "${query}").`;
    }
    return `No JIRA tickets found for query: "${query}"`;
  }
  const employeePrefix = result.employeeContext ? `For ${result.employeeContext}: ` : "";
  const lines = result.tickets.map((t) => {
    const link = baseUrl ? ` ${baseUrl}/browse/${t.id}` : "";
    return `• ${t.id}: ${t.title} (${t.status}) — ${t.assignee} [${t.priority}]${link}`;
  });
  return `${employeePrefix}JIRA tickets (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
