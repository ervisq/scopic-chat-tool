import { queryJira, formatJiraResult } from "../services/jiraService";
import { queryZoho } from "../services/zohoService";
import { querySts, formatStsResult } from "../services/stsService";

export interface ToolResult {
  reply: string;
}

type ToolHandler = (query: string, userId: number) => Promise<ToolResult>;

async function jiraHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryJira(query, userId);
  return { reply: formatJiraResult(result, query) };
}

async function zohoHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryZoho(query, userId);
  return { reply: result.reply };
}

async function stsHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await querySts(query, userId);
  return { reply: formatStsResult(result, query) };
}

const handlers: Record<string, ToolHandler> = {
  JIRA: jiraHandler,
  Zoho: zohoHandler,
  STS: stsHandler,
};

export async function routeToolCommand(tool: string, query: string, userId: number): Promise<ToolResult> {
  const key = Object.keys(handlers).find(
    (k) => k.toLowerCase() === tool.toLowerCase(),
  );

  if (key) {
    return handlers[key](query, userId);
  }

  return {
    reply: `Unknown tool "${tool}". Available tools: ${Object.keys(handlers).join(", ")}`,
  };
}
