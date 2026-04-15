import { queryJira, formatJiraResult } from "../services/jiraService";
import { queryZohoPeopleDirect, queryZohoCrmDirect, queryZohoRecruitDirect, queryZohoContractsDirect } from "../services/zohoService";
import { querySts, formatStsResult } from "../services/stsService";
import { queryTeamwork, formatTeamworkResult } from "../services/teamworkService";
import { queryOutlookDirect } from "../services/outlookService";

export interface ToolResult {
  reply: string;
}

type ToolHandler = (args: Record<string, unknown>, userId: number) => Promise<ToolResult>;

async function stsHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const startDate = args.date_range_start as string | undefined;
  const endDate = args.date_range_end as string | undefined;
  const projectFilter = args.project_filter as string | undefined;

  let query = "my hours";
  if (startDate && endDate) {
    query = `my hours from ${startDate} to ${endDate}`;
    if (projectFilter) {
      query += ` on project "${projectFilter}"`;
    }
  }

  const result = await querySts(query, userId, { startDate, endDate, projectFilter });
  return { reply: formatStsResult(result, query) };
}

async function jiraHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "my tickets";
  const result = await queryJira(query, userId);
  return { reply: formatJiraResult(result, query) };
}

async function teamworkHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "my tasks";
  const result = await queryTeamwork(query, userId);
  return { reply: formatTeamworkResult(result, query) };
}

async function outlookHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "recent emails";
  const result = await queryOutlookDirect(query, userId);
  return { reply: result.reply };
}

async function zohoPeopleHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "employee list";
  const result = await queryZohoPeopleDirect(query, userId);
  return { reply: result.reply };
}

async function zohoCrmHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "contacts";
  const searchEntity = (args.search_entity as string) || undefined;
  const rawOwner = (args.owner_filter as string) || undefined;
  const ownerFilter = rawOwner === "me" ? "me" as const : rawOwner === "all" ? "all" as const : undefined;
  const includeRelated = (args.include_related as boolean) || false;
  const module = (args.module as string) || undefined;
  const isAtMentionOverride = (args._atMentionOverride as boolean) || false;
  const result = await queryZohoCrmDirect(query, userId, { searchEntity, ownerFilter, includeRelated, module, isAtMentionOverride });
  return { reply: result.reply };
}

async function zohoRecruitHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "candidates";
  const result = await queryZohoRecruitDirect(query, userId);
  return { reply: result.reply };
}

async function zohoContractsHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "active contracts";
  const result = await queryZohoContractsDirect(query, userId);
  return { reply: result.reply };
}

const handlers: Record<string, ToolHandler> = {
  STS: stsHandler,
  JIRA: jiraHandler,
  Teamwork: teamworkHandler,
  Outlook: outlookHandler,
  ZohoPeople: zohoPeopleHandler,
  ZohoCRM: zohoCrmHandler,
  ZohoRecruit: zohoRecruitHandler,
  ZohoContracts: zohoContractsHandler,
};

export async function routeToolCommand(
  toolName: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<ToolResult> {
  const key = Object.keys(handlers).find(
    (k) => k.toLowerCase() === toolName.toLowerCase(),
  );

  if (key) {
    return handlers[key](args, userId);
  }

  return {
    reply: `Unknown tool "${toolName}". Available tools: ${Object.keys(handlers).join(", ")}`,
  };
}
