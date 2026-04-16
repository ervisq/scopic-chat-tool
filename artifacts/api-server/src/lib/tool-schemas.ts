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
        "Query Zoho CRM for sales data: leads, contacts, deals, accounts, tasks, events, calls, products, quotes, invoices, campaigns, and vendors. Supports searching by entity name and fetching related data across modules.",
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
            description: "The CRM module to query. If the user asks about a specific entity without specifying a module, default to 'accounts'.",
          },
          search_entity: {
            type: "string",
            description:
              "The specific entity name to search for (e.g. company name, person name, deal name). Extract ONLY the entity/proper noun from the query, not generic words. Examples: 'Portfolio Co', 'John Smith', 'Acme Corp'. Leave empty for generic queries like 'all leads' or 'my tasks'.",
          },
          owner_filter: {
            type: "string",
            enum: ["me", "all"],
            description:
              "Filter by record owner. Use 'me' when the user says 'my tasks', 'tasks I own', 'my deals', 'assigned to me', etc. Default is 'all'.",
          },
          include_related: {
            type: "boolean",
            description:
              "Whether to also fetch related records from other modules. Set to true when the user asks for 'everything about', 'all info on', 'details for', or mentions a specific entity without a module. Default is false.",
          },
          date_range_start: {
            type: "string",
            description:
              "Start date in YYYY-MM-DD format for filtering records by date. Resolve relative dates: 'yesterday' → previous day, 'this week' → Monday of current week, 'last month' → first day of previous month, 'last two weeks' → 14 days ago, etc.",
          },
          date_range_end: {
            type: "string",
            description:
              "End date in YYYY-MM-DD format for filtering records by date. Resolve relative dates: 'yesterday' → yesterday's date, 'this week' → Sunday of current week, 'last month' → last day of previous month, etc.",
          },
          date_field: {
            type: "string",
            enum: ["Created_Time", "Modified_Time", "Closing_Date", "Due_Date", "Start_DateTime", "End_DateTime"],
            description:
              "Which date field to filter on. Use 'Closing_Date' for deals, 'Due_Date' for tasks, 'Start_DateTime' for events/calls, 'Created_Time' for leads/contacts/accounts or when unspecified. Default is 'Created_Time'.",
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
        "Query Zoho Recruit for hiring/recruitment data: candidates, job openings, interviews, and hiring pipeline. Supports filtering by module, entity name, status, date range, and recruiter.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The full natural language query about Zoho Recruit data.",
          },
          module: {
            type: "string",
            enum: ["candidates", "job_openings", "interviews", "pipeline"],
            description:
              "The Recruit module to query. Defaults to candidates if not specified.",
          },
          search_entity: {
            type: "string",
            description:
              "Specific name to search for (candidate name, job title, company name). Extract only the proper noun/name.",
          },
          status_filter: {
            type: "string",
            description:
              "Filter by status. Candidates: New/Qualified/Unqualified/Junk Lead/Contacted/Contact in Future. Jobs: Open/Closed/On-hold/Filled/Cancelled. Interviews: Scheduled/Completed/Cancelled/To-be-scheduled/Waiting.",
          },
          date_range_start: {
            type: "string",
            description:
              "Start of date range in YYYY-MM-DD format for filtering records.",
          },
          date_range_end: {
            type: "string",
            description:
              "End of date range in YYYY-MM-DD format for filtering records.",
          },
          date_field: {
            type: "string",
            enum: ["Created_Time", "Modified_Time", "Date_Opened", "Target_Date", "Interview_Date"],
            description:
              "Which date field to filter by. Defaults: candidates→Created_Time, job_openings→Date_Opened, interviews→Interview_Date.",
          },
          recruiter_filter: {
            type: "string",
            enum: ["me", "all"],
            description:
              "Filter by recruiter/owner. 'me' = only records owned by current user. 'all' = no owner filter.",
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
          search_entity: {
            type: "string",
            description:
              "Specific name to search for (contract name, company name, contract type). Extract only the proper noun/name.",
          },
          status_filter: {
            type: "string",
            enum: ["Active", "Expired", "Pending", "Draft", "Terminated", "Expiring"],
            description:
              "Filter by contract status.",
          },
          owner_filter: {
            type: "string",
            enum: ["me", "all"],
            description:
              "Filter by contract owner. 'me' = only contracts owned by the current user. 'all' = no owner filter (default).",
          },
          date_range_start: {
            type: "string",
            description:
              "Start of date range in YYYY-MM-DD format for filtering contracts.",
          },
          date_range_end: {
            type: "string",
            description:
              "End of date range in YYYY-MM-DD format for filtering contracts.",
          },
          date_field: {
            type: "string",
            enum: ["start_date", "end_date", "created_time"],
            description:
              "Which date field to filter on. 'end_date' for expiring/ending, 'start_date' for started/signed/effective, 'created_time' for created/added. Default: created_time.",
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
