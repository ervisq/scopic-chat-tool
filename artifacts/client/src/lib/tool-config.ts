export interface ToolConfig {
  name: string;
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const TOOLS: ToolConfig[] = [
  {
    name: "JIRA",
    label: "JIRA",
    description: "Query tickets & projects",
    bgColor: "bg-blue-500/15",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
  },
  {
    name: "ZohoPeople",
    label: "Zoho People",
    description: "HR: employees, departments, leave, attendance, timesheets",
    bgColor: "bg-amber-500/15",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/30",
  },
  {
    name: "ZohoCRM",
    label: "Zoho CRM",
    description: "Sales: leads, contacts, deals, tasks, invoices & more",
    bgColor: "bg-orange-500/15",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/30",
  },
  {
    name: "STS",
    label: "STS",
    description: "Query compliance & security",
    bgColor: "bg-emerald-500/15",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/30",
  },
  {
    name: "Teamwork",
    label: "Teamwork",
    description: "Tasks, projects, task lists, milestones, time entries, teams, people, comments, tags & activity",
    bgColor: "bg-purple-500/15",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
  },
];

export function getToolConfig(toolName: string): ToolConfig | undefined {
  return TOOLS.find((t) => t.name.toLowerCase() === toolName.toLowerCase());
}
