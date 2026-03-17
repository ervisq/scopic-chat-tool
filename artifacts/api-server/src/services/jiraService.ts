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
  source: "live" | "mock";
}

let getJiraClient: (() => Promise<any>) | null = null;

export function setJiraClientFactory(factory: () => Promise<any>): void {
  getJiraClient = factory;
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

async function queryJiraLive(query: string): Promise<JiraServiceResult> {
  if (!getJiraClient) {
    throw new Error("Jira client not configured");
  }

  const client = await getJiraClient();

  const jql = buildJql(query);

  const response = await client.get("/rest/api/3/search", {
    params: {
      jql,
      maxResults: 20,
      fields: "summary,status,assignee,priority,issuetype",
    },
  });

  const issues = response.data?.issues || response.issues || [];

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

export async function queryJira(query: string): Promise<JiraServiceResult> {
  if (getJiraClient) {
    try {
      return await queryJiraLive(query);
    } catch (error: any) {
      console.error("Jira API error, falling back to mock:", error?.message);
    }
  }

  const tickets = getMockTickets();
  return { tickets, total: tickets.length, source: "mock" };
}

export function formatJiraResult(result: JiraServiceResult, query: string): string {
  const sourceLabel = result.source === "live" ? "Live JIRA" : "Mock JIRA";
  const lines = result.tickets.map(
    (t) => `• ${t.id}: ${t.title} (${t.status}) — ${t.assignee} [${t.priority}]`,
  );
  return `${sourceLabel} tickets (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
