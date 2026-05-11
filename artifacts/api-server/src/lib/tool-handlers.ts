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
  const employee = (args.employee as string) || undefined;

  const subject = employee ? `${employee}'s` : "my";
  let query = `${subject} hours`;
  if (startDate && endDate) {
    query = `${subject} hours from ${startDate} to ${endDate}`;
    if (projectFilter) {
      query += ` on project "${projectFilter}"`;
    }
  }

  const result = await querySts(query, userId, { startDate, endDate, projectFilter, employee });
  return { reply: formatStsResult(result, query) };
}

async function jiraHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "my tickets";
  const employee = (args.employee as string) || undefined;
  const assignee = (args.assignee as string) || undefined;
  const result = await queryJira(query, userId, { employee, assignee });
  return { reply: formatJiraResult(result, query) };
}

async function teamworkHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "my tasks";
  const employee = (args.employee as string) || undefined;
  const result = await queryTeamwork(query, userId, { employee });
  return { reply: formatTeamworkResult(result, query) };
}

async function outlookHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "recent emails";
  const result = await queryOutlookDirect(query, userId);
  return { reply: result.reply };
}

async function zohoPeopleHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const employee = (args.employee as string) || undefined;
  const query = (args.query as string) || (employee ? `info about ${employee}` : "employee list");
  const result = await queryZohoPeopleDirect(query, userId, { employee });
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
  const dateRangeStart = (args.date_range_start as string) || undefined;
  const dateRangeEnd = (args.date_range_end as string) || undefined;
  const rawDateField = (args.date_field as string) || undefined;
  const dateField = rawDateField as import("../services/zohoCrmService").CrmDateField | undefined;
  const result = await queryZohoCrmDirect(query, userId, { searchEntity, ownerFilter, includeRelated, module, isAtMentionOverride, dateRangeStart, dateRangeEnd, dateField });
  return { reply: result.reply };
}

async function zohoRecruitHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "candidates";
  const module = (args.module as string) || undefined;
  const searchEntity = (args.search_entity as string) || undefined;
  const statusFilter = (args.status_filter as string) || undefined;
  const dateRangeStart = (args.date_range_start as string) || undefined;
  const dateRangeEnd = (args.date_range_end as string) || undefined;
  const dateField = (args.date_field as string) || undefined;
  const rawRecruiter = (args.recruiter_filter as string) || undefined;
  const recruiterFilter = rawRecruiter === "me" ? "me" as const : rawRecruiter === "all" ? "all" as const : undefined;
  const result = await queryZohoRecruitDirect(query, userId, {
    module, searchEntity, statusFilter, dateRangeStart, dateRangeEnd, dateField, recruiterFilter,
  });
  return { reply: result.reply };
}

async function zohoContractsHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "active contracts";
  const searchEntity = (args.search_entity as string) || undefined;
  const statusFilter = (args.status_filter as string) || undefined;
  const rawOwner = (args.owner_filter as string) || undefined;
  const ownerFilter = rawOwner === "me" ? "me" as const : rawOwner === "all" ? "all" as const : undefined;
  const dateRangeStart = (args.date_range_start as string) || undefined;
  const dateRangeEnd = (args.date_range_end as string) || undefined;
  const dateField = (args.date_field as string) || undefined;
  const result = await queryZohoContractsDirect(query, userId, {
    searchEntity, statusFilter, ownerFilter, dateRangeStart, dateRangeEnd, dateField,
  });
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
