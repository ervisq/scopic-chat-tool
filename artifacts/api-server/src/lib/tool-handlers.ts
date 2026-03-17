export interface ToolResult {
  reply: string;
}

function jiraHandler(query: string): ToolResult {
  return {
    reply: `Here are your JIRA tickets:\n• JIRA-101: Fix login bug (In Progress)\n• JIRA-102: Update dashboard UI (To Do)\n• JIRA-103: API rate limiting (Done)\n\nQuery: "${query}"`,
  };
}

function zohoHandler(query: string): ToolResult {
  return {
    reply: `Here are your Zoho candidates:\n• Alice Johnson — Frontend Developer (Interview Scheduled)\n• Bob Smith — Backend Engineer (Under Review)\n• Carol Lee — DevOps Specialist (Shortlisted)\n\nQuery: "${query}"`,
  };
}

function stsHandler(query: string): ToolResult {
  return {
    reply: `STS Status Report:\n• Service: Auth Gateway — Healthy\n• Service: Payment API — Degraded\n• Service: Notification Service — Healthy\n\nQuery: "${query}"`,
  };
}

const handlers: Record<string, (query: string) => ToolResult> = {
  JIRA: jiraHandler,
  Zoho: zohoHandler,
  STS: stsHandler,
};

export function routeToolCommand(tool: string, query: string): ToolResult {
  const key = Object.keys(handlers).find(
    (k) => k.toLowerCase() === tool.toLowerCase(),
  );

  if (key) {
    return handlers[key](query);
  }

  return {
    reply: `Unknown tool "${tool}". Available tools: ${Object.keys(handlers).join(", ")}`,
  };
}
