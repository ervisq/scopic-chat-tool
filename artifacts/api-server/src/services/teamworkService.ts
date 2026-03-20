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
}

export interface TeamworkProject {
  id: number;
  name: string;
  description: string;
  status: string;
  company: string;
  startDate: string;
  endDate: string;
}

export interface TeamworkMilestone {
  id: number;
  title: string;
  deadline: string;
  completed: boolean;
  projectName: string;
  responsible: string;
}

export interface TeamworkTimEntry {
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

export interface TeamworkServiceResult {
  source: "live" | "not_connected" | "error";
  type: "tasks" | "projects" | "milestones" | "time" | "people" | "summary";
  data: TeamworkTask[] | TeamworkProject[] | TeamworkMilestone[] | TeamworkTimEntry[] | TeamworkPerson[];
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
  });
}

type QueryCategory = "tasks" | "projects" | "milestones" | "time" | "people";

function detectCategory(query: string): QueryCategory {
  const lower = query.toLowerCase();

  if (lower.includes("time") || lower.includes("hour") || lower.includes("log") || lower.includes("timesheet") || lower.includes("tracked")) {
    return "time";
  }
  if (lower.includes("milestone") || lower.includes("deadline")) {
    return "milestones";
  }
  if (lower.includes("project") || lower.includes("workspace")) {
    return "projects";
  }
  if (lower.includes("people") || lower.includes("team member") || lower.includes("teammate") || lower.includes("person") || lower.includes("coworker") || lower.includes("who is") || lower.includes("who are") || lower.includes("staff") || lower.includes("employee")) {
    return "people";
  }
  return "tasks";
}

function buildTaskParams(query: string): Record<string, string | number | boolean> {
  const lower = query.toLowerCase();
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "projects,assignees",
  };

  if (lower.includes("my") || lower.includes("assigned to me")) {
    params["assignedToMe"] = true;
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
  if (lower.includes("high priority") || lower.includes("urgent") || lower.includes("critical")) {
    params["priority"] = "high";
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
    };
  });

  return { source: "live", type: "tasks", data: mapped, total: mapped.length };
}

async function fetchProjects(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/projects.json", {
    params: { pageSize: 25, include: "companies" },
  });
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
    };
  });

  return { source: "live", type: "projects", data: mapped, total: mapped.length };
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

  const mapped: TeamworkTimEntry[] = entries.slice(0, 25).map((e: Record<string, unknown>) => {
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
        return await fetchProjects(siteUrl, apiToken);
      case "milestones":
        return await fetchMilestones(siteUrl, apiToken);
      case "time":
        return await fetchTimeEntries(siteUrl, apiToken);
      case "people":
        return await fetchPeople(siteUrl, apiToken);
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
        (t) => `• #${t.id}: ${t.name} (${t.status}) — ${t.assignee} [${t.priority}]${t.dueDate ? ` due ${t.dueDate}` : ""}${t.projectName ? ` | ${t.projectName}` : ""}`,
      );
      return `Teamwork tasks (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "projects": {
      const projects = result.data as TeamworkProject[];
      const lines = projects.map(
        (p) => `• ${p.name} (${p.status})${p.company ? ` — ${p.company}` : ""}${p.startDate ? ` | ${p.startDate}` : ""}${p.endDate ? ` → ${p.endDate}` : ""}`,
      );
      return `Teamwork projects (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "milestones": {
      const milestones = result.data as TeamworkMilestone[];
      const lines = milestones.map(
        (m) => `• ${m.title} — ${m.completed ? "✓ Completed" : `Due: ${m.deadline || "No deadline"}`}${m.projectName ? ` | ${m.projectName}` : ""}${m.responsible ? ` (${m.responsible})` : ""}`,
      );
      return `Teamwork milestones (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "time": {
      const entries = result.data as TeamworkTimEntry[];
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
    default:
      return `Teamwork data (${result.total} items found) for query: "${query}"`;
  }
}
