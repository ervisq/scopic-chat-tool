import { queryJira, formatJiraResult } from "../services/jiraService";
import { queryZohoPeopleDirect, queryZohoCrmDirect, queryZohoRecruitDirect, queryZohoContractsDirect } from "../services/zohoService";
import { querySts, formatStsResult } from "../services/stsService";
import { queryTeamwork, formatTeamworkResult } from "../services/teamworkService";
import { queryOutlookDirect } from "../services/outlookService";

export interface ToolResult {
  reply: string;
}

type ToolHandler = (query: string, userId: number) => Promise<ToolResult>;

async function jiraHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryJira(query, userId);
  return { reply: formatJiraResult(result, query) };
}

async function zohoPeopleHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryZohoPeopleDirect(query, userId);
  return { reply: result.reply };
}

async function zohoCrmHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryZohoCrmDirect(query, userId);
  return { reply: result.reply };
}

async function stsHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await querySts(query, userId);
  return { reply: formatStsResult(result, query) };
}

async function teamworkHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryTeamwork(query, userId);
  return { reply: formatTeamworkResult(result, query) };
}

async function zohoRecruitHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryZohoRecruitDirect(query, userId);
  return { reply: result.reply };
}

async function zohoContractsHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryZohoContractsDirect(query, userId);
  return { reply: result.reply };
}

async function outlookHandler(query: string, userId: number): Promise<ToolResult> {
  const result = await queryOutlookDirect(query, userId);
  return { reply: result.reply };
}

const handlers: Record<string, ToolHandler> = {
  JIRA: jiraHandler,
  ZohoPeople: zohoPeopleHandler,
  ZohoCRM: zohoCrmHandler,
  ZohoRecruit: zohoRecruitHandler,
  ZohoContracts: zohoContractsHandler,
  STS: stsHandler,
  Teamwork: teamworkHandler,
  Outlook: outlookHandler,
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
