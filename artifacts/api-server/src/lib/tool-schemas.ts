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
          employee: {
            type: "string",
            description:
              "Optional employee name or email to scope the time query to. Use when the user asks about another employee's hours (e.g. 'how many hours did John Smith log this week'). Leave empty for the caller's own hours. Permissions are enforced by STS; if the caller doesn't have rights, no results will be returned.",
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
              "Optional free-text search keywords ONLY (words to match in ticket summary/description). Leave empty (\"\") when the user is only filtering by assignee/status/priority, e.g. 'my open tickets' or 'high priority bugs'.",
          },
          assignee: {
            type: "string",
            description:
              "Filter by assignee. Use 'me' if the user says 'my tickets', 'unassigned' for unassigned tickets, 'all' for everyone, or a person's name/email (e.g. 'John Smith') to filter to that specific person's tickets. Default is 'all'.",
          },
          employee: {
            type: "string",
            description:
              "Optional employee name or email to scope the JIRA query to. Use when the user asks about another employee's tickets by name (e.g. 'show John Smith's open tickets'). The name will be resolved against the JIRA user directory. Permissions are enforced by JIRA; if the caller doesn't have rights, no results will be returned.",
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
              "Optional free-text search keywords ONLY (e.g. a specific task name, project name, or text to match). Leave empty (\"\") when the user is just listing/filtering, e.g. 'my open tasks' or 'time logged last week'.",
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
              "messages",
              "tags",
              "activity",
            ],
            description:
              "Which kind of Teamwork data the user wants. tasks=to-do items; tasklists=lists that group tasks; projects=projects/workspaces; milestones=deadlines; time=time logs/hours; people=people directory; teams=teams; comments=comments on tasks; messages=project message-board posts; tags=labels; activity=recent activity feed. Default 'tasks'.",
          },
          assignee_scope: {
            type: "string",
            enum: ["me", "all", "unassigned"],
            description:
              "For tasks/time: whose items to return. 'me' = the caller's own, 'unassigned' = tasks with no assignee, 'all' = everyone. When the user names ANOTHER person, leave this 'all' and set 'employee' instead. Default 'all'.",
          },
          status: {
            type: "string",
            enum: ["active", "completed", "overdue", "all"],
            description:
              "For tasks: 'active' = open/incomplete, 'completed' = done, 'overdue' = past due. Default 'all'.",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low", "all"],
            description: "For tasks: filter by priority. Default 'all'.",
          },
          date_range_start: {
            type: "string",
            description:
              "Start date in YYYY-MM-DD. For category 'time' this filters time logs by date; for 'tasks' it filters by due date. Resolve relative dates (this week = Monday of current week; last month = first day of previous month, etc.).",
          },
          date_range_end: {
            type: "string",
            description:
              "End date in YYYY-MM-DD (see date_range_start). Resolve relative dates the same way.",
          },
          billable_only: {
            type: "boolean",
            description: "For category 'time': return only billable entries. Default false.",
          },
          employee: {
            type: "string",
            description:
              "Optional employee name or email to scope the Teamwork query to ANOTHER person (e.g. 'John Smith's tasks', 'hours logged by Maria'). Resolved against the Teamwork people directory. Leave empty for the caller themselves. Permissions are enforced by Teamwork.",
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
        "Query Microsoft Outlook for the CALLER's emails, calendar events, and contacts only. This tool always operates on the calling user's own mailbox — it cannot read another employee's mailbox. Use when the user asks about their own emails, inbox, meetings, schedule, or contacts.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Free-text search keywords ONLY (e.g. a subject, sender name, or contact name to find). Leave empty (\"\") when just listing (e.g. 'my unread emails', 'meetings this week').",
          },
          category: {
            type: "string",
            enum: ["mail", "calendar", "contacts"],
            description:
              "The type of Outlook data to query. 'mail' for emails/inbox, 'calendar' for meetings/schedule/events, 'contacts' for people/phone numbers.",
          },
          date_range_start: {
            type: "string",
            description:
              "Start date in YYYY-MM-DD. For mail filters by received date; for calendar sets the window start. Resolve relative dates (this week = Monday; last month = first day of previous month, etc.).",
          },
          date_range_end: {
            type: "string",
            description: "End date in YYYY-MM-DD (see date_range_start).",
          },
          unread_only: {
            type: "boolean",
            description: "Mail only: return just unread emails. Default false.",
          },
          from_sender: {
            type: "string",
            description: "Mail only: filter to emails from this sender's email address (e.g. 'jane@acme.com'). Only set when the user names a sender.",
          },
          has_attachments: {
            type: "boolean",
            description: "Mail only: return just emails that have attachments. Default false.",
          },
          free_time: {
            type: "boolean",
            description: "Calendar only: compute free/available time slots instead of listing events (for 'when am I free', 'availability', 'open slots'). Default false.",
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
        "Query Zoho People for HR data: employees, departments, leave requests, attendance, timesheets, birthdays, work anniversaries, new joiners, headcount, and information about specific employees by name.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Optional free-text search keywords ONLY. Leave empty (\"\") for listing/filtering intents.",
          },
          sub_intent: {
            type: "string",
            enum: [
              "employee_detail",
              "directory",
              "birthdays",
              "anniversaries",
              "new_joiners",
              "leave_today",
              "leave",
              "attendance",
              "departments",
              "timesheets",
              "headcount",
              "manager",
            ],
            description:
              "Which HR data the user wants. employee_detail=one person's profile (set 'employee' too); directory=all employees; birthdays/anniversaries/new_joiners=date-based people lists (set 'period'); leave_today=who is off today; leave=leave requests; attendance=check-in/attendance records (set 'period'); departments=department list; timesheets=logged hours; headcount=active employee count; manager=reporting/org hierarchy. Defaults to employee_detail when an employee is named, else directory.",
          },
          period: {
            type: "string",
            enum: ["today", "this_week", "last_week", "this_month", "last_month", "this_year"],
            description:
              "Time period for date-based sub-intents (birthdays, anniversaries, new_joiners, attendance). Resolve the user's phrasing to one of these.",
          },
          employee: {
            type: "string",
            description:
              "Optional employee name or email to look up or scope to (e.g. 'John Smith', 'Maria Garcia'). Use when the user asks about a particular employee. Permissions are enforced by Zoho People.",
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
  {
    type: "function",
    function: {
      name: "report_unsupported",
      description:
        "Call this when the user is asking about data from one of the integrated apps (JIRA, Teamwork, Outlook, STS, or any Zoho product) but you CANNOT confidently determine which tool to use or the parameters required, OR when the request is a write/modify/create/delete action (this assistant is READ-ONLY). Do NOT call this for general conversation, greetings, or questions unrelated to the integrated apps — for those, simply answer without calling any function.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "A brief, user-facing reason the request can't be fulfilled (e.g. 'write actions are not supported', 'couldn't tell which app this refers to').",
          },
        },
        required: [],
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
