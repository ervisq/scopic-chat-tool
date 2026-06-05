import { queryJira, formatJiraResult, type JiraQueryOptions } from "../services/jiraService";
import { queryZohoPeopleDirect, queryZohoCrmDirect, queryZohoRecruitDirect, queryZohoContractsDirect } from "../services/zohoService";
import type { PeopleSubIntent } from "../services/zohoPeopleService";

const PEOPLE_SUB_INTENTS: ReadonlySet<string> = new Set([
  "employee_detail", "directory", "birthdays", "anniversaries", "new_joiners",
  "leave_today", "leave", "attendance", "departments", "timesheets", "headcount", "manager",
]);
import { querySts, formatStsResult } from "../services/stsService";
import { queryTeamwork, formatTeamworkResult, type TeamworkQueryOptions, type TeamworkCategory } from "../services/teamworkService";

const TEAMWORK_CATEGORIES: ReadonlySet<string> = new Set([
  "tasks", "projects", "milestones", "tasklists", "time",
  "teams", "people", "comments", "messages", "tags", "activity",
]);
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
  const query = (args.query as string) || "";
  const employee = (args.employee as string) || undefined;
  const assignee = (args.assignee as string) || undefined;
  const status = args.status as JiraQueryOptions["status"];
  const priority = args.priority as JiraQueryOptions["priority"];
  const result = await queryJira(query, userId, { employee, assignee, status, priority });
  return { reply: formatJiraResult(result, query || "your request") };
}

async function teamworkHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "";
  const employee = (args.employee as string) || undefined;
  const rawCategory = args.category as string | undefined;
  const category = rawCategory && TEAMWORK_CATEGORIES.has(rawCategory)
    ? (rawCategory as TeamworkCategory)
    : undefined;
  const assigneeScope = args.assignee_scope as TeamworkQueryOptions["assigneeScope"];
  const status = args.status as TeamworkQueryOptions["status"];
  const priority = args.priority as TeamworkQueryOptions["priority"];
  const dateFrom = (args.date_range_start as string) || undefined;
  const dateTo = (args.date_range_end as string) || undefined;
  const billableOnly = (args.billable_only as boolean) || undefined;
  const result = await queryTeamwork(query, userId, {
    employee, category, assigneeScope, status, priority, dateFrom, dateTo, billableOnly,
  });
  return { reply: formatTeamworkResult(result, query || "your request") };
}

async function outlookHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const query = (args.query as string) || "";
  const rawCategory = args.category as string | undefined;
  const category = rawCategory === "calendar" || rawCategory === "contacts" || rawCategory === "mail"
    ? rawCategory
    : undefined;
  const result = await queryOutlookDirect(query, userId, {
    category,
    dateFrom: (args.date_range_start as string) || undefined,
    dateTo: (args.date_range_end as string) || undefined,
    unreadOnly: (args.unread_only as boolean) || undefined,
    fromSender: (args.from_sender as string) || undefined,
    hasAttachments: (args.has_attachments as boolean) || undefined,
    freeTime: (args.free_time as boolean) || undefined,
  });
  return { reply: result.reply };
}

async function zohoPeopleHandler(args: Record<string, unknown>, userId: number): Promise<ToolResult> {
  const employee = (args.employee as string) || undefined;
  const query = (args.query as string) || (employee ? `info about ${employee}` : "employee list");
  const rawSubIntent = args.sub_intent as string | undefined;
  const subIntent = rawSubIntent && PEOPLE_SUB_INTENTS.has(rawSubIntent)
    ? (rawSubIntent as PeopleSubIntent)
    : undefined;
  const period = (args.period as string) || undefined;
  const result = await queryZohoPeopleDirect(query, userId, { employee, subIntent, period });
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
