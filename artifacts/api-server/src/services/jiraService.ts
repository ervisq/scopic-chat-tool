export interface JiraTicket {
  id: string;
  title: string;
  status: "To Do" | "In Progress" | "Done";
  assignee: string;
  priority: "Low" | "Medium" | "High";
}

export interface JiraServiceResult {
  tickets: JiraTicket[];
  total: number;
}

export async function queryJira(query: string): Promise<JiraServiceResult> {
  const tickets: JiraTicket[] = [
    { id: "JIRA-101", title: "Fix login bug", status: "In Progress", assignee: "Alice", priority: "High" },
    { id: "JIRA-102", title: "Update dashboard UI", status: "To Do", assignee: "Bob", priority: "Medium" },
    { id: "JIRA-103", title: "API rate limiting", status: "Done", assignee: "Carol", priority: "High" },
    { id: "JIRA-104", title: "Add unit tests for auth module", status: "To Do", assignee: "Alice", priority: "Low" },
    { id: "JIRA-105", title: "Database migration script", status: "In Progress", assignee: "Dave", priority: "Medium" },
  ];

  return { tickets, total: tickets.length };
}

export function formatJiraResult(result: JiraServiceResult, query: string): string {
  const lines = result.tickets.map(
    (t) => `• ${t.id}: ${t.title} (${t.status}) — ${t.assignee} [${t.priority}]`,
  );
  return `Here are your JIRA tickets (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
