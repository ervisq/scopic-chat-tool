import { queryJira, formatJiraResult } from "../services/jiraService";
import { queryZoho, formatZohoResult } from "../services/zohoService";
import { querySts, formatStsResult } from "../services/stsService";

export interface ToolResult {
  reply: string;
}

type ToolHandler = (query: string) => Promise<ToolResult>;

async function jiraHandler(query: string): Promise<ToolResult> {
  const result = await queryJira(query);
  return { reply: formatJiraResult(result, query) };
}

async function zohoHandler(query: string): Promise<ToolResult> {
  const result = await queryZoho(query);
  return { reply: formatZohoResult(result, query) };
}

async function stsHandler(query: string): Promise<ToolResult> {
  const result = await querySts(query);
  return { reply: formatStsResult(result, query) };
}

const handlers: Record<string, ToolHandler> = {
  JIRA: jiraHandler,
  Zoho: zohoHandler,
  STS: stsHandler,
};

export async function routeToolCommand(tool: string, query: string): Promise<ToolResult> {
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
