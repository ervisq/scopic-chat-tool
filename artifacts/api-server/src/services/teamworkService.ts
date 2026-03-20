import axios from "axios";
import { getUserCredentials } from "../lib/credential-store";

export interface TeamworkTask {
  id: number;
  name: string;
  status: string;
  assignee: string;
  priority: string;
  dueDate: string;
  projectName: string;
  taskListName: string;
}

export interface TeamworkProject {
  id: number;
  name: string;
  description: string;
  status: string;
  company: string;
  startDate: string;
  endDate: string;
  lastUpdated: string;
}

export interface TeamworkTaskList {
  id: number;
  name: string;
  description: string;
  projectName: string;
  taskCount: number;
  milestone: string;
}

export interface TeamworkMilestone {
  id: number;
  title: string;
  deadline: string;
  completed: boolean;
  projectName: string;
  responsible: string;
}

export interface TeamworkTimeEntry {
  id: number;
  description: string;
  hours: number;
  minutes: number;
  date: string;
  person: string;
  projectName: string;
  taskName: string;
}

export interface TeamworkPerson {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
}

export interface TeamworkTeam {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  projectNames: string[];
}

type TeamworkData = TeamworkTask[] | TeamworkProject[] | TeamworkTaskList[] | TeamworkMilestone[] | TeamworkTimeEntry[] | TeamworkPerson[] | TeamworkTeam[];
type ResultType = "tasks" | "projects" | "tasklists" | "milestones" | "time" | "people" | "teams";

export interface TeamworkServiceResult {
  source: "live" | "not_connected" | "error";
  type: ResultType;
  data: TeamworkData;
  total: number;
  message?: string;
}

function isValidTeamworkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false;
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("172.")) return false;
    if (hostname === "169.254.169.254") return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    if (/^\[?::1\]?$/.test(hostname) || /^\[?fe80:/i.test(hostname) || /^\[?fd[0-9a-f]{2}:/i.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function createClient(siteUrl: string, apiToken: string) {
  const baseUrl = siteUrl.replace(/\/$/, "");
  return axios.create({
    baseURL: baseUrl,
    auth: {
      username: apiToken,
      password: "x",
    },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 15000,
    maxRedirects: 0,
  });
}

type QueryCategory = "tasks" | "projects" | "tasklists" | "milestones" | "time" | "people" | "teams";

function detectCategory(query: string): QueryCategory {
  const lower = query.toLowerCase();

  if (lower.includes("time") || lower.includes("hour") || lower.includes("log") || lower.includes("timesheet") || lower.includes("tracked")) {
    return "time";
  }
  if (lower.includes("milestone") || lower.includes("deadline")) {
    return "milestones";
  }
  if (lower.includes("task list") || lower.includes("tasklist") || lower.includes("list of task")) {
    return "tasklists";
  }
  if (lower.includes("team") && !lower.includes("task") && !lower.includes("project")) {
    return "teams";
  }
  if (lower.includes("project update") || lower.includes("project status") || lower.includes("project") || lower.includes("workspace")) {
    return "projects";
  }
  if (lower.includes("people") || lower.includes("team member") || lower.includes("teammate") || lower.includes("person") || lower.includes("coworker") || lower.includes("who is") || lower.includes("who are") || lower.includes("staff") || lower.includes("employee")) {
    return "people";
  }
  return "tasks";
}

function extractAssigneeFilter(query: string): string | null {
  const lower = query.toLowerCase();
  const assignedToMatch = lower.match(/assigned\s+to\s+["']?([^"',]+)["']?/);
  if (assignedToMatch) return assignedToMatch[1].trim();
  const byMatch = lower.match(/(?:tasks?\s+(?:for|by))\s+["']?([^"',]+)["']?/);
  if (byMatch) return byMatch[1].trim();
  return null;
}

function extractDueDateFilter(query: string): { startDate?: string; endDate?: string } {
  const lower = query.toLowerCase();
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  if (lower.includes("due today")) {
    const d = fmt(today);
    return { startDate: d, endDate: d };
  }
  if (lower.includes("due this week") || lower.includes("this week")) {
    const end = new Date(today);
    end.setDate(today.getDate() + (7 - today.getDay()));
    return { startDate: fmt(today), endDate: fmt(end) };
  }
  if (lower.includes("due this month") || lower.includes("this month")) {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { startDate: fmt(today), endDate: fmt(end) };
  }
  if (lower.includes("due next week") || lower.includes("next week")) {
    const start = new Date(today);
    start.setDate(today.getDate() + (7 - today.getDay()) + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { startDate: fmt(start), endDate: fmt(end) };
  }

  const dateMatch = lower.match(/due\s+(?:before|by)\s+(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return { endDate: dateMatch[1] };
  }
  const afterMatch = lower.match(/due\s+after\s+(\d{4}-\d{2}-\d{2})/);
  if (afterMatch) {
    return { startDate: afterMatch[1] };
  }

  return {};
}

function buildTaskParams(query: string): Record<string, string | number | boolean> {
  const lower = query.toLowerCase();
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "projects,assignees,taskLists",
  };

  if (lower.includes("my") || lower.includes("assigned to me")) {
    params["assignedToMe"] = true;
  }

  const assignee = extractAssigneeFilter(query);
  if (assignee && assignee !== "me") {
    params["searchAssignees"] = assignee;
  }

  if (lower.includes("completed") || lower.includes("done") || lower.includes("closed")) {
    params["includeCompletedTasks"] = true;
    params["completedOnly"] = true;
  } else if (lower.includes("overdue") || lower.includes("late")) {
    params["includeOverdueTasks"] = true;
    params["overdueOnly"] = true;
  } else if (lower.includes("active") || lower.includes("open") || lower.includes("in progress")) {
    params["includeCompletedTasks"] = false;
  }

  if (lower.includes("latest") || lower.includes("recent")) {
    params["orderBy"] = "updatedAt";
    params["orderMode"] = "desc";
  }

  if (lower.includes("high priority") || lower.includes("urgent") || lower.includes("critical")) {
    params["priority"] = "high";
  } else if (lower.includes("medium priority")) {
    params["priority"] = "medium";
  } else if (lower.includes("low priority")) {
    params["priority"] = "low";
  }

  const dueDateFilter = extractDueDateFilter(query);
  if (dueDateFilter.startDate) {
    params["dueDateFrom"] = dueDateFilter.startDate;
  }
  if (dueDateFilter.endDate) {
    params["dueDateTo"] = dueDateFilter.endDate;
  }

  return params;
}

async function fetchTasks(siteUrl: string, apiToken: string, query: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const params = buildTaskParams(query);

  const response = await client.get("/projects/api/v3/tasks.json", { params });
  const tasks = response.data?.tasks || [];

  const mapped: TeamworkTask[] = tasks.slice(0, 25).map((t: Record<string, unknown>) => {
    const assignees = t.assignees as Record<string, unknown>[] | undefined;
    const project = t.project as Record<string, unknown> | undefined;
    const taskList = t.taskList as Record<string, unknown> | undefined;
    return {
      id: t.id as number,
      name: (t.name as string) || "Untitled",
      status: (t.status as string) || "unknown",
      assignee: assignees && assignees.length > 0
        ? `${(assignees[0] as Record<string, unknown>).firstName || ""} ${(assignees[0] as Record<string, unknown>).lastName || ""}`.trim()
        : "Unassigned",
      priority: (t.priority as string) || "none",
      dueDate: (t.dueDate as string) || "",
      projectName: (project?.name as string) || "",
      taskListName: (taskList?.name as string) || "",
    };
  });

  return { source: "live", type: "tasks", data: mapped, total: mapped.length };
}

async function fetchProjects(siteUrl: string, apiToken: string, query: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const lower = query.toLowerCase();
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "companies",
  };

  if (lower.includes("active") || lower.includes("current")) {
    params["status"] = "active";
  } else if (lower.includes("completed") || lower.includes("archived")) {
    params["status"] = "completed";
  }

  if (lower.includes("recent") || lower.includes("update") || lower.includes("latest")) {
    params["orderBy"] = "lastActivityAt";
    params["orderMode"] = "desc";
  }

  const response = await client.get("/projects/api/v3/projects.json", { params });
  const projects = response.data?.projects || [];

  const mapped: TeamworkProject[] = projects.slice(0, 25).map((p: Record<string, unknown>) => {
    const company = p.company as Record<string, unknown> | undefined;
    return {
      id: p.id as number,
      name: (p.name as string) || "Untitled",
      description: (p.description as string) || "",
      status: (p.status as string) || "unknown",
      company: (company?.name as string) || "",
      startDate: (p.startDate as string) || "",
      endDate: (p.endDate as string) || "",
      lastUpdated: (p.updatedAt as string) || (p.lastActivityAt as string) || "",
    };
  });

  return { source: "live", type: "projects", data: mapped, total: mapped.length };
}

async function fetchTaskLists(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/tasklists.json", {
    params: { pageSize: 25, include: "projects,milestones" },
  });
  const tasklists = response.data?.tasklists || [];

  const mapped: TeamworkTaskList[] = tasklists.slice(0, 25).map((tl: Record<string, unknown>) => {
    const project = tl.project as Record<string, unknown> | undefined;
    const milestone = tl.milestone as Record<string, unknown> | undefined;
    return {
      id: tl.id as number,
      name: (tl.name as string) || "Untitled",
      description: (tl.description as string) || "",
      projectName: (project?.name as string) || "",
      taskCount: (tl.taskCount as number) || 0,
      milestone: (milestone?.title as string) || "",
    };
  });

  return { source: "live", type: "tasklists", data: mapped, total: mapped.length };
}

async function fetchMilestones(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/milestones.json", {
    params: { pageSize: 25 },
  });
  const milestones = response.data?.milestones || [];

  const mapped: TeamworkMilestone[] = milestones.slice(0, 25).map((m: Record<string, unknown>) => {
    const project = m.project as Record<string, unknown> | undefined;
    const responsible = m.responsibleParty as Record<string, unknown> | undefined;
    return {
      id: m.id as number,
      title: (m.title as string) || "Untitled",
      deadline: (m.deadline as string) || "",
      completed: (m.completed as boolean) || false,
      projectName: (project?.name as string) || "",
      responsible: responsible
        ? `${(responsible.firstName as string) || ""} ${(responsible.lastName as string) || ""}`.trim()
        : "",
    };
  });

  return { source: "live", type: "milestones", data: mapped, total: mapped.length };
}

async function fetchTimeEntries(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/time.json", {
    params: { pageSize: 25 },
  });
  const entries = response.data?.timelogs || [];

  const mapped: TeamworkTimeEntry[] = entries.slice(0, 25).map((e: Record<string, unknown>) => {
    const project = e.project as Record<string, unknown> | undefined;
    const task = e.task as Record<string, unknown> | undefined;
    const person = e.user as Record<string, unknown> | undefined;
    return {
      id: e.id as number,
      description: (e.description as string) || "",
      hours: (e.hours as number) || 0,
      minutes: (e.minutes as number) || 0,
      date: (e.date as string) || "",
      person: person
        ? `${(person.firstName as string) || ""} ${(person.lastName as string) || ""}`.trim()
        : "",
      projectName: (project?.name as string) || "",
      taskName: (task?.name as string) || "",
    };
  });

  return { source: "live", type: "time", data: mapped, total: mapped.length };
}

async function fetchPeople(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/people.json", {
    params: { pageSize: 50 },
  });
  const people = response.data?.people || [];

  const mapped: TeamworkPerson[] = people.slice(0, 50).map((p: Record<string, unknown>) => {
    const company = p.company as Record<string, unknown> | undefined;
    return {
      id: p.id as number,
      firstName: (p.firstName as string) || "",
      lastName: (p.lastName as string) || "",
      email: (p.emailAddress as string) || "",
      company: (company?.name as string) || "",
      title: (p.title as string) || "",
    };
  });

  return { source: "live", type: "people", data: mapped, total: mapped.length };
}

async function fetchTeams(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/teams.json", {
    params: { pageSize: 25, include: "projects" },
  });
  const teams = response.data?.teams || [];

  const mapped: TeamworkTeam[] = teams.slice(0, 25).map((t: Record<string, unknown>) => {
    const projects = t.projects as Record<string, unknown>[] | undefined;
    const members = t.members as Record<string, unknown>[] | undefined;
    return {
      id: t.id as number,
      name: (t.name as string) || "Untitled",
      description: (t.description as string) || "",
      memberCount: members ? members.length : ((t.memberCount as number) || 0),
      projectNames: projects ? projects.map((p) => (p.name as string) || "") : [],
    };
  });

  return { source: "live", type: "teams", data: mapped, total: mapped.length };
}

export async function queryTeamwork(query: string, userId?: number): Promise<TeamworkServiceResult> {
  if (!userId) {
    return { source: "not_connected", type: "tasks", data: [], total: 0 };
  }

  const cred = await getUserCredentials(userId, "teamwork");
  if (!cred) {
    return { source: "not_connected", type: "tasks", data: [], total: 0 };
  }

  const { apiToken } = cred.credentials;
  const siteUrl = cred.instanceUrl;
  if (!apiToken || !siteUrl) {
    return { source: "not_connected", type: "tasks", data: [], total: 0 };
  }

  if (!isValidTeamworkUrl(siteUrl)) {
    return { source: "error", type: "tasks", data: [], total: 0, message: "Invalid Teamwork site URL" };
  }

  const category = detectCategory(query);

  try {
    switch (category) {
      case "projects":
        return await fetchProjects(siteUrl, apiToken, query);
      case "tasklists":
        return await fetchTaskLists(siteUrl, apiToken);
      case "milestones":
        return await fetchMilestones(siteUrl, apiToken);
      case "time":
        return await fetchTimeEntries(siteUrl, apiToken);
      case "people":
        return await fetchPeople(siteUrl, apiToken);
      case "teams":
        return await fetchTeams(siteUrl, apiToken);
      case "tasks":
      default:
        return await fetchTasks(siteUrl, apiToken, query);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Teamwork API error:", msg);
    return { source: "error", type: category, data: [], total: 0, message: "Failed to fetch data from Teamwork" };
  }
}

export function formatTeamworkResult(result: TeamworkServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your Teamwork account is not connected. Please go to Connected Services to link your Teamwork credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to Teamwork. Please check your credentials in Connected Services and try again.";
  }

  if (result.total === 0) {
    return `No Teamwork ${result.type} found for query: "${query}"`;
  }

  switch (result.type) {
    case "tasks": {
      const tasks = result.data as TeamworkTask[];
      const lines = tasks.map(
        (t) => `• #${t.id}: ${t.name} (${t.status}) — ${t.assignee} [${t.priority}]${t.dueDate ? ` due ${t.dueDate}` : ""}${t.projectName ? ` | ${t.projectName}` : ""}${t.taskListName ? ` [${t.taskListName}]` : ""}`,
      );
      return `Teamwork tasks (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "projects": {
      const projects = result.data as TeamworkProject[];
      const lines = projects.map(
        (p) => `• ${p.name} (${p.status})${p.company ? ` — ${p.company}` : ""}${p.startDate ? ` | ${p.startDate}` : ""}${p.endDate ? ` → ${p.endDate}` : ""}${p.lastUpdated ? ` (updated: ${p.lastUpdated})` : ""}`,
      );
      return `Teamwork projects (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "tasklists": {
      const lists = result.data as TeamworkTaskList[];
      const lines = lists.map(
        (tl) => `• ${tl.name} — ${tl.taskCount} task${tl.taskCount !== 1 ? "s" : ""}${tl.projectName ? ` | ${tl.projectName}` : ""}${tl.milestone ? ` (milestone: ${tl.milestone})` : ""}${tl.description ? `: ${tl.description}` : ""}`,
      );
      return `Teamwork task lists (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "milestones": {
      const milestones = result.data as TeamworkMilestone[];
      const lines = milestones.map(
        (m) => `• ${m.title} — ${m.completed ? "✓ Completed" : `Due: ${m.deadline || "No deadline"}`}${m.projectName ? ` | ${m.projectName}` : ""}${m.responsible ? ` (${m.responsible})` : ""}`,
      );
      return `Teamwork milestones (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "time": {
      const entries = result.data as TeamworkTimeEntry[];
      const totalHours = entries.reduce((sum, e) => sum + e.hours + e.minutes / 60, 0);
      const lines = entries.map(
        (e) => `• ${e.date}: ${e.hours}h${e.minutes}m — ${e.person}${e.taskName ? ` on "${e.taskName}"` : ""}${e.projectName ? ` (${e.projectName})` : ""}${e.description ? `: ${e.description}` : ""}`,
      );
      return `Teamwork time entries (${result.total} found, ${totalHours.toFixed(1)} total hours):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "people": {
      const people = result.data as TeamworkPerson[];
      const lines = people.map(
        (p) => `• ${p.firstName} ${p.lastName}${p.title ? ` — ${p.title}` : ""}${p.email ? ` (${p.email})` : ""}${p.company ? ` | ${p.company}` : ""}`,
      );
      return `Teamwork people (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "teams": {
      const teams = result.data as TeamworkTeam[];
      const lines = teams.map(
        (t) => `• ${t.name} — ${t.memberCount} member${t.memberCount !== 1 ? "s" : ""}${t.projectNames.length > 0 ? ` | Projects: ${t.projectNames.join(", ")}` : ""}${t.description ? `: ${t.description}` : ""}`,
      );
      return `Teamwork teams (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    default:
      return `Teamwork data (${result.total} items found) for query: "${query}"`;
  }
}
