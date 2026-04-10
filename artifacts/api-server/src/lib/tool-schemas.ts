import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "query_sts",
      description:
        "Query STS (Scopic Time System) for working hours and time tracking data. Use when the user asks about hours logged, time entries, work hours, or time tracking.",
      parameters: {
        type: "object",
        properties: {
          date_range_start: {
            type: "string",
            description:
              "Start date in YYYY-MM-DD format. Resolve relative dates (e.g. 'this week' means Monday of current week, 'last month' means first day of previous month).",
          },
          date_range_end: {
            type: "string",
            description:
              "End date in YYYY-MM-DD format. Resolve relative dates (e.g. 'this week' means Sunday of current week, 'last month' means last day of previous month).",
          },
          project_filter: {
            type: "string",
            description:
              "Optional project name to filter results by. Only include if the user explicitly mentions a specific project name.",
          },
        },
        required: ["date_range_start", "date_range_end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_jira",
      description:
        "Query JIRA for tickets, issues, bugs, sprints, epics, stories, and backlog items. Use when the user asks about JIRA tickets, bugs, sprints, or project issues.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about JIRA data to pass through for processing.",
          },
          assignee: {
            type: "string",
            enum: ["me", "unassigned", "all"],
            description:
              "Filter by assignee. Use 'me' if the user says 'my tickets', 'assigned to me', etc. Default is 'all'.",
          },
          status: {
            type: "string",
            enum: ["open", "in_progress", "done", "all"],
            description:
              "Filter by status. 'open' for active/open tickets, 'done' for completed/closed, 'in_progress' for in-progress items.",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low", "all"],
            description: "Filter by priority level.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_teamwork",
      description:
        "Query Teamwork for project management data: tasks, projects, milestones, time entries, teams, people, comments, tags, and activity logs.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about Teamwork data.",
          },
          category: {
            type: "string",
            enum: [
              "tasks",
              "projects",
              "milestones",
              "tasklists",
              "time",
              "teams",
              "people",
              "comments",
              "tags",
              "activity",
            ],
            description:
              "The type of Teamwork data to query. Default is 'tasks'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_outlook",
      description:
        "Query Microsoft Outlook for emails, calendar events, and contacts. Use when the user asks about emails, inbox, meetings, schedule, or contacts.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about Outlook data.",
          },
          category: {
            type: "string",
            enum: ["mail", "calendar", "contacts"],
            description:
              "The type of Outlook data to query. 'mail' for emails/inbox, 'calendar' for meetings/schedule/events, 'contacts' for people/phone numbers.",
          },
        },
        required: ["query", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_zoho_people",
      description:
        "Query Zoho People for HR data: employees, departments, leave requests, attendance, timesheets, birthdays, work anniversaries, new joiners, and headcount.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about Zoho People HR data.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_zoho_crm",
      description:
        "Query Zoho CRM for sales data: leads, contacts, deals, accounts, tasks, events, calls, products, quotes, invoices, campaigns, and vendors.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about Zoho CRM data.",
          },
          module: {
            type: "string",
            enum: [
              "leads",
              "contacts",
              "deals",
              "accounts",
              "tasks",
              "events",
              "calls",
              "products",
              "quotes",
              "invoices",
              "campaigns",
              "vendors",
            ],
            description: "The CRM module to query.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_zoho_recruit",
      description:
        "Query Zoho Recruit for hiring/recruitment data: candidates, job openings, interviews, and hiring pipeline.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about Zoho Recruit data.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_zoho_contracts",
      description:
        "Query Zoho Contracts for contract data: active contracts, expired contracts, pending/draft contracts, expiring soon, contract details.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about Zoho Contracts data.",
          },
        },
        required: ["query"],
      },
    },
  },
];

export const TOOL_NAME_MAP: Record<string, string> = {
  query_sts: "STS",
  query_jira: "JIRA",
  query_teamwork: "Teamwork",
  query_outlook: "Outlook",
  query_zoho_people: "ZohoPeople",
  query_zoho_crm: "ZohoCRM",
  query_zoho_recruit: "ZohoRecruit",
  query_zoho_contracts: "ZohoContracts",
};
