import axios from "axios";
import { getUserCredentials } from "../lib/credential-store";

export interface TeamworkTask {
  id: number;
  name: string;
  description: string;
  status: string;
  assignee: string;
  priority: string;
  dueDate: string;
  startDate: string;
  progress: number;
  estimatedMinutes: number;
  projectName: string;
  taskListName: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  parentTaskId: number | null;
  commentCount: number;
}

export interface TeamworkProject {
  id: number;
  name: string;
  description: string;
  status: string;
  company: string;
  category: string;
  startDate: string;
  endDate: string;
  lastUpdated: string;
  owner: string;
  tags: string[];
  taskCount: number;
  health: number;
}

export interface TeamworkTaskList {
  id: number;
  name: string;
  description: string;
  projectName: string;
  taskCount: number;
  completedCount: number;
  milestone: string;
  status: string;
}

export interface TeamworkMilestone {
  id: number;
  title: string;
  description: string;
  deadline: string;
  completed: boolean;
  projectName: string;
  responsible: string;
  tags: string[];
  createdAt: string;
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
  isBillable: boolean;
  tags: string[];
  createdAt: string;
}

export interface TeamworkPerson {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  role: string;
  phone: string;
  isAdmin: boolean;
  lastLogin: string;
  createdAt: string;
}

export interface TeamworkTeam {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  members: string[];
  projectNames: string[];
}

export interface TeamworkComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
  taskName: string;
  projectName: string;
}

export interface TeamworkTag {
  id: number;
  name: string;
  color: string;
  projectId: number;
  projectName: string;
}

export interface TeamworkActivity {
  id: number;
  description: string;
  activityType: string;
  person: string;
  date: string;
  projectName: string;
  itemLink: string;
}

type TeamworkData = TeamworkTask[] | TeamworkProject[] | TeamworkTaskList[] | TeamworkMilestone[] | TeamworkTimeEntry[] | TeamworkPerson[] | TeamworkTeam[] | TeamworkComment[] | TeamworkTag[] | TeamworkActivity[];
type ResultType = "tasks" | "projects" | "tasklists" | "milestones" | "time" | "people" | "teams" | "comments" | "tags" | "activity";

export interface TeamworkServiceResult {
  source: "live" | "not_connected" | "error";
  type: ResultType;
  data: TeamworkData;
  total: number;
  message?: string;
  instanceUrl?: string | null;
  employeeContext?: string;
  employeeMessage?: string;
}

export interface TeamworkQueryOptions {
  employee?: string;
}

interface ResolvedTeamworkPerson {
  id: number;
  displayName: string;
  email: string;
}

async function resolveTeamworkPerson(siteUrl: string, apiToken: string, term: string): Promise<{ matches: ResolvedTeamworkPerson[]; lookupSucceeded: boolean }> {
  const client = createClient(siteUrl, apiToken);
  try {
    const response = await client.get("/projects/api/v3/people.json", {
      params: { searchTerm: term, pageSize: 25 },
    });
    const people = response.data?.people || [];
    const lowered = term.toLowerCase();
    const mapped: ResolvedTeamworkPerson[] = people.map((p: Record<string, unknown>) => ({
      id: (p.id as number) || 0,
      displayName: extractPersonName(p) || ((p.emailAddress as string) || ""),
      email: ((p.emailAddress as string) || "").toLowerCase(),
    })).filter((p: ResolvedTeamworkPerson) => p.id > 0);
    // Filter on client side too — Teamwork searchTerm is broad
    const filtered = mapped.filter((p) => p.displayName.toLowerCase().includes(lowered) || p.email.includes(lowered));
    return { matches: filtered.length > 0 ? filtered : mapped, lookupSucceeded: true };
  } catch (err) {
    console.error("Teamwork person lookup failed:", (err as Error).message);
    return { matches: [], lookupSucceeded: false };
  }
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

type QueryCategory = "tasks" | "projects" | "tasklists" | "milestones" | "time" | "people" | "teams" | "comments" | "tags" | "activity";

function detectCategory(query: string): QueryCategory {
  const lower = query.toLowerCase();

  if (lower.includes("comment") || lower.includes("discussion") || lower.includes("note on task") || lower.includes("reply") || lower.includes("feedback on")) {
    return "comments";
  }
  if (lower.includes("tag") || lower.includes("label") || lower.includes("category")) {
    return "tags";
  }
  if (lower.includes("activity") || lower.includes("recent changes") || lower.includes("what happened") || lower.includes("history") || lower.includes("changelog")) {
    return "activity";
  }
  if (lower.includes("time") || lower.includes("hour") || lower.includes("log") || lower.includes("timesheet") || lower.includes("tracked") || lower.includes("billable")) {
    return "time";
  }
  if (lower.includes("milestone") || lower.includes("deadline")) {
    return "milestones";
  }
  if (lower.includes("task list") || lower.includes("tasklist") || lower.includes("list of task")) {
    return "tasklists";
  }
  if (lower.includes("team") && !lower.includes("task") && !lower.includes("project") && !lower.includes("teamwork")) {
    return "teams";
  }
  if (lower.includes("project update") || lower.includes("project status") || lower.includes("project") || lower.includes("workspace")) {
    return "projects";
  }
  if (lower.includes("people") || lower.includes("team member") || lower.includes("teammate") || lower.includes("person") || lower.includes("coworker") || lower.includes("who is") || lower.includes("who are") || lower.includes("staff") || lower.includes("employee") || lower.includes("contact")) {
    return "people";
  }
  return "tasks";
}

async function fetchCurrentUserId(siteUrl: string, apiToken: string): Promise<number | null> {
  try {
    const client = createClient(siteUrl, apiToken);
    const response = await client.get("/me.json");
    const person = response.data?.person || response.data?.account || response.data;
    return (person?.id as number) || null;
  } catch {
    return null;
  }
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

function buildTaskParams(query: string, currentUserId?: number | null, employeePersonId?: number): Record<string, string | number | boolean> {
  const lower = query.toLowerCase();
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "projects,assignees,taskLists,tags",
  };

  if (employeePersonId) {
    params["responsiblePartyIds"] = employeePersonId;
  } else if (lower.includes("my") || lower.includes("assigned to me")) {
    if (currentUserId) {
      params["responsiblePartyIds"] = currentUserId;
    } else {
      params["assignedToMe"] = true;
    }
  } else {
    const assignee = extractAssigneeFilter(query);
    if (assignee && assignee !== "me") {
      params["searchAssignees"] = assignee;
    }
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

function extractPersonName(obj: Record<string, unknown> | undefined): string {
  if (!obj) return "";
  return `${(obj.firstName as string) || ""} ${(obj.lastName as string) || ""}`.trim();
}

function extractTags(tagList: unknown): string[] {
  if (!Array.isArray(tagList)) return [];
  return tagList.map((tag: Record<string, unknown>) => (tag.name as string) || "").filter(Boolean);
}

async function fetchTasks(siteUrl: string, apiToken: string, query: string, currentUserId?: number | null, employeePersonId?: number): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const params = buildTaskParams(query, currentUserId, employeePersonId);

  const response = await client.get("/projects/api/v3/tasks.json", { params });
  const tasks = response.data?.tasks || [];

  const mapped: TeamworkTask[] = tasks.slice(0, 25).map((t: Record<string, unknown>) => {
    const assignees = t.assignees as Record<string, unknown>[] | undefined;
    const project = t.project as Record<string, unknown> | undefined;
    const taskList = t.taskList as Record<string, unknown> | undefined;
    return {
      id: t.id as number,
      name: (t.name as string) || "Untitled",
      description: (t.description as string) || "",
      status: (t.status as string) || "unknown",
      assignee: assignees && assignees.length > 0 ? extractPersonName(assignees[0] as Record<string, unknown>) : "Unassigned",
      priority: (t.priority as string) || "none",
      dueDate: (t.dueDate as string) || "",
      startDate: (t.startDate as string) || "",
      progress: (t.progress as number) || 0,
      estimatedMinutes: (t.estimatedMinutes as number) || 0,
      projectName: (project?.name as string) || "",
      taskListName: (taskList?.name as string) || "",
      tags: extractTags(t.tags),
      createdAt: (t.createdAt as string) || "",
      updatedAt: (t.updatedAt as string) || "",
      parentTaskId: (t.parentTaskId as number) || null,
      commentCount: (t.commentCount as number) || 0,
    };
  });

  return { source: "live", type: "tasks", data: mapped, total: mapped.length };
}

async function fetchProjects(siteUrl: string, apiToken: string, query: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const lower = query.toLowerCase();
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "companies,tags",
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
    const owner = p.owner as Record<string, unknown> | undefined;
    return {
      id: p.id as number,
      name: (p.name as string) || "Untitled",
      description: (p.description as string) || "",
      status: (p.status as string) || "unknown",
      company: (company?.name as string) || "",
      category: (p.category as string) || "",
      startDate: (p.startDate as string) || "",
      endDate: (p.endDate as string) || "",
      lastUpdated: (p.updatedAt as string) || (p.lastActivityAt as string) || "",
      owner: owner ? extractPersonName(owner) : "",
      tags: extractTags(p.tags),
      taskCount: ((p.taskCounts as Record<string, unknown>)?.total as number) || 0,
      health: (p.health as number) || 0,
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
      completedCount: (tl.completedCount as number) || 0,
      milestone: (milestone?.title as string) || "",
      status: (tl.status as string) || "",
    };
  });

  return { source: "live", type: "tasklists", data: mapped, total: mapped.length };
}

async function fetchMilestones(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/milestones.json", {
    params: { pageSize: 25, include: "tags" },
  });
  const milestones = response.data?.milestones || [];

  const mapped: TeamworkMilestone[] = milestones.slice(0, 25).map((m: Record<string, unknown>) => {
    const project = m.project as Record<string, unknown> | undefined;
    const responsible = m.responsibleParty as Record<string, unknown> | undefined;
    return {
      id: m.id as number,
      title: (m.title as string) || "Untitled",
      description: (m.description as string) || "",
      deadline: (m.deadline as string) || "",
      completed: (m.completed as boolean) || false,
      projectName: (project?.name as string) || "",
      responsible: responsible ? extractPersonName(responsible) : "",
      tags: extractTags(m.tags),
      createdAt: (m.createdAt as string) || "",
    };
  });

  return { source: "live", type: "milestones", data: mapped, total: mapped.length };
}

async function fetchTimeEntries(siteUrl: string, apiToken: string, query: string, employeePersonId?: number): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const lower = query.toLowerCase();
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "tags",
  };

  if (employeePersonId) {
    params["userIds"] = employeePersonId;
  } else if (lower.includes("my") || lower.includes("mine")) {
    params["assignedToMe"] = true;
  }
  if (lower.includes("billable")) {
    params["isBillable"] = true;
  }

  const response = await client.get("/projects/api/v3/time.json", { params });
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
      person: person ? extractPersonName(person) : "",
      projectName: (project?.name as string) || "",
      taskName: (task?.name as string) || "",
      isBillable: (e.isBillable as boolean) || false,
      tags: extractTags(e.tags),
      createdAt: (e.createdAt as string) || "",
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
      role: (p.userRole as string) || (p.type as string) || "",
      phone: (p.phoneNumberMobile as string) || (p.phoneNumberOffice as string) || "",
      isAdmin: (p.isAdmin as boolean) || false,
      lastLogin: (p.lastLogin as string) || "",
      createdAt: (p.createdAt as string) || "",
    };
  });

  return { source: "live", type: "people", data: mapped, total: mapped.length };
}

async function fetchTeams(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/teams.json", {
    params: { pageSize: 25, include: "projects,members" },
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
      members: members ? members.map((m) => extractPersonName(m)).filter(Boolean) : [],
      projectNames: projects ? projects.map((p) => (p.name as string) || "").filter(Boolean) : [],
    };
  });

  return { source: "live", type: "teams", data: mapped, total: mapped.length };
}

async function fetchComments(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/comments.json", {
    params: { pageSize: 25, orderBy: "createdAt", orderMode: "desc" },
  });
  const comments = response.data?.comments || [];

  const mapped: TeamworkComment[] = comments.slice(0, 25).map((c: Record<string, unknown>) => {
    const author = c.author as Record<string, unknown> | undefined;
    const task = c.task as Record<string, unknown> | undefined;
    const project = c.project as Record<string, unknown> | undefined;
    return {
      id: c.id as number,
      body: (c.body as string) || (c.htmlBody as string) || "",
      author: author ? extractPersonName(author) : "",
      createdAt: (c.createdAt as string) || "",
      taskName: (task?.name as string) || "",
      projectName: (project?.name as string) || "",
    };
  });

  return { source: "live", type: "comments", data: mapped, total: mapped.length };
}

async function fetchTags(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/tags.json", {
    params: { pageSize: 50 },
  });
  const tags = response.data?.tags || [];

  const mapped: TeamworkTag[] = tags.slice(0, 50).map((tag: Record<string, unknown>) => {
    const project = tag.project as Record<string, unknown> | undefined;
    return {
      id: tag.id as number,
      name: (tag.name as string) || "",
      color: (tag.color as string) || "",
      projectId: (tag.projectId as number) || 0,
      projectName: (project?.name as string) || "",
    };
  });

  return { source: "live", type: "tags", data: mapped, total: mapped.length };
}

async function fetchActivity(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/latestactivity.json", {
    params: { pageSize: 25 },
  });
  const activities = response.data?.activities || response.data?.activity || [];

  const mapped: TeamworkActivity[] = activities.slice(0, 25).map((a: Record<string, unknown>) => {
    const user = a.user as Record<string, unknown> | undefined;
    const project = a.project as Record<string, unknown> | undefined;
    return {
      id: a.id as number,
      description: (a.description as string) || (a.activityDescription as string) || "",
      activityType: (a.type as string) || (a.activityType as string) || "",
      person: user ? extractPersonName(user) : "",
      date: (a.dateTime as string) || (a.createdAt as string) || "",
      projectName: (project?.name as string) || "",
      itemLink: (a.link as string) || "",
    };
  });

  return { source: "live", type: "activity", data: mapped, total: mapped.length };
}

export async function queryTeamwork(query: string, userId?: number, opts?: TeamworkQueryOptions): Promise<TeamworkServiceResult> {
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
  const lower = query.toLowerCase();
  const needsMyUserId = category === "tasks" && (lower.includes("my") || lower.includes("assigned to me"));
  const currentUserId = needsMyUserId ? await fetchCurrentUserId(siteUrl, apiToken) : null;

  let employeePersonId: number | undefined;
  let employeeContext: string | undefined;
  if (opts?.employee && opts.employee.trim()) {
    const term = opts.employee.trim();
    const { matches, lookupSucceeded } = await resolveTeamworkPerson(siteUrl, apiToken, term);
    if (!lookupSucceeded) {
      return { source: "error", type: category, data: [], total: 0, message: `Could not look up Teamwork people. Your account may not have permission to view the people directory.` };
    }
    if (matches.length === 0) {
      return { source: "live", type: category, data: [], total: 0, instanceUrl: siteUrl, employeeMessage: `No Teamwork person matched "${term}".` };
    }
    if (matches.length > 1) {
      const list = matches.slice(0, 5).map((m) => `${m.displayName}${m.email ? ` (${m.email})` : ""}`).join(", ");
      return { source: "live", type: category, data: [], total: 0, instanceUrl: siteUrl, employeeMessage: `Multiple Teamwork people matched "${term}": ${list}. Please be more specific.` };
    }
    employeePersonId = matches[0].id;
    employeeContext = matches[0].displayName || matches[0].email || term;
  }

  try {
    let result: TeamworkServiceResult;
    switch (category) {
      case "projects":
        result = await fetchProjects(siteUrl, apiToken, query);
        break;
      case "tasklists":
        result = await fetchTaskLists(siteUrl, apiToken);
        break;
      case "milestones":
        result = await fetchMilestones(siteUrl, apiToken);
        break;
      case "time":
        result = await fetchTimeEntries(siteUrl, apiToken, query, employeePersonId);
        break;
      case "people":
        result = await fetchPeople(siteUrl, apiToken);
        break;
      case "teams":
        result = await fetchTeams(siteUrl, apiToken);
        break;
      case "comments":
        result = await fetchComments(siteUrl, apiToken);
        break;
      case "tags":
        result = await fetchTags(siteUrl, apiToken);
        break;
      case "activity":
        result = await fetchActivity(siteUrl, apiToken);
        break;
      case "tasks":
      default:
        result = await fetchTasks(siteUrl, apiToken, query, currentUserId, employeePersonId);
        break;
    }
    result.instanceUrl = siteUrl;
    if (employeeContext) result.employeeContext = employeeContext;
    return result;
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
    if (result.message) return result.message;
    return "There was an error connecting to Teamwork. Please check your credentials in Connected Services and try again.";
  }

  if (result.employeeMessage) {
    return result.employeeMessage;
  }
  if (result.total === 0) {
    if (result.employeeContext) {
      return `No Teamwork ${result.type} found for ${result.employeeContext} (query: "${query}").`;
    }
    return `No Teamwork ${result.type} found for query: "${query}"`;
  }

  const baseUrl = result.instanceUrl ? result.instanceUrl.replace(/\/$/, "") : "";
  const employeePrefix = result.employeeContext ? `For ${result.employeeContext}: ` : "";

  switch (result.type) {
    case "tasks": {
      const tasks = result.data as TeamworkTask[];
      const lines = tasks.map((t) => {
        let line = `• #${t.id}: ${t.name} (${t.status}) — ${t.assignee} [${t.priority}]`;
        if (t.progress > 0) line += ` ${t.progress}% done`;
        if (t.dueDate) line += ` due ${t.dueDate}`;
        if (t.startDate) line += ` started ${t.startDate}`;
        if (t.estimatedMinutes > 0) line += ` est. ${Math.round(t.estimatedMinutes / 60)}h`;
        if (t.projectName) line += ` | ${t.projectName}`;
        if (t.taskListName) line += ` [${t.taskListName}]`;
        if (t.tags.length > 0) line += ` tags: ${t.tags.join(", ")}`;
        if (t.commentCount > 0) line += ` (${t.commentCount} comments)`;
        if (baseUrl) line += ` ${baseUrl}/app/tasks/${t.id}`;
        if (t.description) line += `\n  Description: ${t.description.substring(0, 200)}${t.description.length > 200 ? "..." : ""}`;
        return line;
      });
      return `${employeePrefix}Teamwork tasks (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "projects": {
      const projects = result.data as TeamworkProject[];
      const lines = projects.map((p) => {
        let line = `• ${p.name} (${p.status})`;
        if (p.owner) line += ` owned by ${p.owner}`;
        if (p.company) line += ` — ${p.company}`;
        if (p.category) line += ` [${p.category}]`;
        if (p.startDate) line += ` | ${p.startDate}`;
        if (p.endDate) line += ` → ${p.endDate}`;
        if (p.taskCount > 0) line += ` (${p.taskCount} tasks)`;
        if (p.lastUpdated) line += ` updated: ${p.lastUpdated}`;
        if (p.tags.length > 0) line += ` tags: ${p.tags.join(", ")}`;
        if (baseUrl) line += ` ${baseUrl}/app/projects/${p.id}`;
        if (p.description) line += `\n  ${p.description.substring(0, 200)}${p.description.length > 200 ? "..." : ""}`;
        return line;
      });
      return `Teamwork projects (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "tasklists": {
      const lists = result.data as TeamworkTaskList[];
      const lines = lists.map((tl) => {
        let line = `• ${tl.name} — ${tl.taskCount} task${tl.taskCount !== 1 ? "s" : ""} (${tl.completedCount} completed)`;
        if (tl.projectName) line += ` | ${tl.projectName}`;
        if (tl.milestone) line += ` (milestone: ${tl.milestone})`;
        if (tl.status) line += ` [${tl.status}]`;
        if (tl.description) line += `: ${tl.description.substring(0, 150)}`;
        return line;
      });
      return `Teamwork task lists (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "milestones": {
      const milestones = result.data as TeamworkMilestone[];
      const lines = milestones.map((m) => {
        let line = `• ${m.title} — ${m.completed ? "✓ Completed" : `Due: ${m.deadline || "No deadline"}`}`;
        if (m.projectName) line += ` | ${m.projectName}`;
        if (m.responsible) line += ` (${m.responsible})`;
        if (m.tags.length > 0) line += ` tags: ${m.tags.join(", ")}`;
        if (m.description) line += `\n  ${m.description.substring(0, 200)}${m.description.length > 200 ? "..." : ""}`;
        return line;
      });
      return `Teamwork milestones (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "time": {
      const entries = result.data as TeamworkTimeEntry[];
      const totalHours = entries.reduce((sum, e) => sum + e.hours + e.minutes / 60, 0);
      const billableHours = entries.filter((e) => e.isBillable).reduce((sum, e) => sum + e.hours + e.minutes / 60, 0);
      const lines = entries.map((e) => {
        let line = `• ${e.date}: ${e.hours}h${e.minutes}m — ${e.person}`;
        if (e.isBillable) line += " [billable]";
        if (e.taskName) line += ` on "${e.taskName}"`;
        if (e.projectName) line += ` (${e.projectName})`;
        if (e.tags.length > 0) line += ` tags: ${e.tags.join(", ")}`;
        if (e.description) line += `: ${e.description}`;
        return line;
      });
      let header = `${employeePrefix}Teamwork time entries (${result.total} found, ${totalHours.toFixed(1)} total hours`;
      if (billableHours > 0) header += `, ${billableHours.toFixed(1)} billable`;
      header += "):";
      return `${header}\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "people": {
      const people = result.data as TeamworkPerson[];
      const lines = people.map((p) => {
        let line = `• ${p.firstName} ${p.lastName}`;
        if (p.title) line += ` — ${p.title}`;
        if (p.role) line += ` (${p.role})`;
        if (p.email) line += ` | ${p.email}`;
        if (p.phone) line += ` | ${p.phone}`;
        if (p.company) line += ` | ${p.company}`;
        if (p.isAdmin) line += " [Admin]";
        if (p.lastLogin) line += ` last login: ${p.lastLogin}`;
        return line;
      });
      return `Teamwork people (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "teams": {
      const teams = result.data as TeamworkTeam[];
      const lines = teams.map((t) => {
        let line = `• ${t.name} — ${t.memberCount} member${t.memberCount !== 1 ? "s" : ""}`;
        if (t.members.length > 0) line += `: ${t.members.join(", ")}`;
        if (t.projectNames.length > 0) line += ` | Projects: ${t.projectNames.join(", ")}`;
        if (t.description) line += `\n  ${t.description.substring(0, 150)}`;
        return line;
      });
      return `Teamwork teams (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "comments": {
      const comments = result.data as TeamworkComment[];
      const lines = comments.map((c) => {
        let line = `• ${c.author} on ${c.createdAt}`;
        if (c.taskName) line += ` — task: "${c.taskName}"`;
        if (c.projectName) line += ` (${c.projectName})`;
        line += `\n  ${c.body.replace(/<[^>]+>/g, "").substring(0, 300)}${c.body.length > 300 ? "..." : ""}`;
        return line;
      });
      return `Teamwork comments (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "tags": {
      const tags = result.data as TeamworkTag[];
      const lines = tags.map((tag) => {
        let line = `• ${tag.name}`;
        if (tag.color) line += ` (${tag.color})`;
        if (tag.projectName) line += ` | ${tag.projectName}`;
        return line;
      });
      return `Teamwork tags (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    case "activity": {
      const activities = result.data as TeamworkActivity[];
      const lines = activities.map((a) => {
        let line = `• ${a.date}: ${a.person} — ${a.activityType}`;
        if (a.description) line += `: ${a.description.replace(/<[^>]+>/g, "").substring(0, 200)}`;
        if (a.projectName) line += ` (${a.projectName})`;
        return line;
      });
      return `Teamwork recent activity (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
    }
    default:
      return `Teamwork data (${result.total} items found) for query: "${query}"`;
  }
}
