import type { ComponentProps } from "react";
import { TOOL_ICON_MAP } from "@/components/chat/tool-icons";

export interface ToolConfig {
  name: string;
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon?: (props: ComponentProps<"svg">) => JSX.Element;
}

export const TOOLS: ToolConfig[] = [
  {
    name: "JIRA",
    label: "JIRA",
    description: "Query tickets & projects",
    bgColor: "bg-blue-500/15",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
    icon: TOOL_ICON_MAP["JIRA"],
  },
  {
    name: "ZohoPeople",
    label: "Zoho People",
    description: "HR: employees, departments, leave, attendance, timesheets",
    bgColor: "bg-amber-500/15",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/30",
    icon: TOOL_ICON_MAP["ZohoPeople"],
  },
  {
    name: "ZohoCRM",
    label: "Zoho CRM",
    description: "Sales: leads, contacts, deals, tasks, invoices & more",
    bgColor: "bg-orange-500/15",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/30",
    icon: TOOL_ICON_MAP["ZohoCRM"],
  },
  {
    name: "ZohoRecruit",
    label: "Zoho Recruit",
    description: "Recruiting: candidates, job openings, interviews, hiring pipeline",
    bgColor: "bg-rose-500/15",
    textColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-500/30",
    icon: TOOL_ICON_MAP["ZohoRecruit"],
  },
  {
    name: "ZohoContracts",
    label: "Zoho Contracts",
    description: "Contracts: active, expired, expiring, by company or type",
    bgColor: "bg-teal-500/15",
    textColor: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-500/30",
    icon: TOOL_ICON_MAP["ZohoContracts"],
  },
  {
    name: "STS",
    label: "STS",
    description: "Working hours: this week, by project, daily breakdown",
    bgColor: "bg-emerald-500/15",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/30",
    icon: TOOL_ICON_MAP["STS"],
  },
  {
    name: "Teamwork",
    label: "Teamwork",
    description: "Tasks, projects, task lists, milestones, time entries, teams, people, comments, tags & activity",
    bgColor: "bg-purple-500/15",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
    icon: TOOL_ICON_MAP["Teamwork"],
  },
  {
    name: "Outlook",
    label: "Outlook",
    description: "Email, calendar events, contacts from Microsoft 365",
    bgColor: "bg-sky-500/15",
    textColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-500/30",
    icon: TOOL_ICON_MAP["Outlook"],
  },
];

export function getToolConfig(toolName: string): ToolConfig | undefined {
  return TOOLS.find((t) => t.name.toLowerCase() === toolName.toLowerCase());
}
