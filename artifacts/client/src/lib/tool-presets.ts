export interface PresetQuery {
  label: string;
  query: string;
}

export const TOOL_PRESETS: Record<string, PresetQuery[]> = {
  JIRA: [
    { label: "My open tickets", query: "@JIRA show my open tickets" },
    { label: "Tickets I'm watching", query: "@JIRA show tickets I'm watching" },
    { label: "Overdue tickets", query: "@JIRA what's overdue?" },
    { label: "Tickets updated today", query: "@JIRA show tickets updated today" },
    { label: "High priority tickets", query: "@JIRA show high priority tickets" },
    { label: "Tickets in progress", query: "@JIRA show tickets in progress" },
    { label: "Recently closed tickets", query: "@JIRA show recently closed tickets" },
    { label: "All my projects", query: "@JIRA list all my projects" },
  ],
  ZohoPeople: [
    { label: "All employees", query: "@ZohoPeople show all employees" },
    { label: "Who's on leave today", query: "@ZohoPeople who's on leave today?" },
    { label: "My pending leave requests", query: "@ZohoPeople show my pending leave requests" },
    { label: "My attendance this week", query: "@ZohoPeople show my attendance this week" },
    { label: "My timesheets this week", query: "@ZohoPeople show my timesheets this week" },
    { label: "Departments list", query: "@ZohoPeople list all departments" },
    { label: "Birthdays this month", query: "@ZohoPeople show birthdays this month" },
    { label: "New hires this month", query: "@ZohoPeople show new hires this month" },
  ],
  ZohoCRM: [
    { label: "Leads created today", query: "@ZohoCRM leads created today" },
    { label: "Leads created this week", query: "@ZohoCRM leads created this week" },
    { label: "Deals closing this week", query: "@ZohoCRM deals closing this week" },
    { label: "My open tasks", query: "@ZohoCRM show my open tasks" },
    { label: "Recent deals", query: "@ZohoCRM list recent deals" },
    { label: "All contacts", query: "@ZohoCRM show all contacts" },
    { label: "All accounts", query: "@ZohoCRM show all accounts" },
    { label: "Open invoices", query: "@ZohoCRM show open invoices" },
  ],
  ZohoRecruit: [
    { label: "All candidates", query: "@ZohoRecruit show all candidates" },
    { label: "New candidates this week", query: "@ZohoRecruit candidates added this week" },
    { label: "Open job positions", query: "@ZohoRecruit show open job openings" },
    { label: "Interviews scheduled", query: "@ZohoRecruit show scheduled interviews" },
    { label: "Interviews this week", query: "@ZohoRecruit interviews this week" },
    { label: "My interviews", query: "@ZohoRecruit show my interviews" },
    { label: "Hiring pipeline", query: "@ZohoRecruit show the hiring pipeline" },
    { label: "Closed positions", query: "@ZohoRecruit show closed job openings" },
  ],
  ZohoContracts: [
    { label: "Active contracts", query: "@ZohoContracts show active contracts" },
    { label: "Expiring soon", query: "@ZohoContracts what's expiring soon?" },
    { label: "Expired contracts", query: "@ZohoContracts show expired contracts" },
    { label: "Contracts signed this month", query: "@ZohoContracts contracts signed this month" },
    { label: "My contracts", query: "@ZohoContracts show my contracts" },
    { label: "Drafts pending approval", query: "@ZohoContracts show drafts pending approval" },
    { label: "NDAs", query: "@ZohoContracts show NDA contracts" },
    { label: "Terminated contracts", query: "@ZohoContracts show terminated contracts" },
  ],
  STS: [
    { label: "My hours this week", query: "@STS show my hours this week" },
    { label: "My hours today", query: "@STS show my hours today" },
    { label: "My hours last week", query: "@STS show my hours last week" },
    { label: "Hours by project this month", query: "@STS hours by project this month" },
    { label: "Daily breakdown this week", query: "@STS show daily breakdown this week" },
    { label: "My hours this month", query: "@STS show my hours this month" },
  ],
  Teamwork: [
    { label: "My tasks", query: "@Teamwork show my tasks" },
    { label: "Tasks due this week", query: "@Teamwork tasks due this week" },
    { label: "Overdue tasks", query: "@Teamwork show overdue tasks" },
    { label: "All projects", query: "@Teamwork list all projects" },
    { label: "Upcoming milestones", query: "@Teamwork show upcoming milestones" },
    { label: "My time entries this week", query: "@Teamwork my time entries this week" },
    { label: "Recent activity", query: "@Teamwork show recent activity" },
    { label: "Team members", query: "@Teamwork list team members" },
  ],
  Outlook: [
    { label: "Recent unread emails", query: "@Outlook show my recent unread emails" },
    { label: "Today's emails", query: "@Outlook emails received today" },
    { label: "Today's calendar", query: "@Outlook show today's calendar events" },
    { label: "This week's meetings", query: "@Outlook show this week's meetings" },
    { label: "Tomorrow's schedule", query: "@Outlook what's on my calendar tomorrow?" },
    { label: "Important emails", query: "@Outlook show flagged or important emails" },
    { label: "My contacts", query: "@Outlook list my contacts" },
  ],
};

export function getPresetsForTool(toolName: string): PresetQuery[] {
  return TOOL_PRESETS[toolName] ?? [];
}
