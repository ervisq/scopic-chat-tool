import axios from "axios";
import { getTeamworkAccessToken, TeamworkPermissionError } from "./teamworkTokenManager";
import { getCachedNameResolution, setCachedNameResolution } from "../lib/name-resolution-cache";

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

export interface TeamworkMessage {
  id: number;
  title: string;
  body: string;
  author: string;
  postedAt: string;
  projectName: string;
}

type TeamworkData = TeamworkTask[] | TeamworkProject[] | TeamworkTaskList[] | TeamworkMilestone[] | TeamworkTimeEntry[] | TeamworkPerson[] | TeamworkTeam[] | TeamworkComment[] | TeamworkMessage[] | TeamworkTag[] | TeamworkActivity[];
type ResultType = "tasks" | "projects" | "tasklists" | "milestones" | "time" | "people" | "teams" | "comments" | "messages" | "tags" | "activity";

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

export type TeamworkCategory = ResultType;

export interface TeamworkQueryOptions {
  employee?: string;
  /** Which kind of Teamwork data to fetch (LLM-provided). Defaults to "tasks". */
  category?: TeamworkCategory;
  /** For tasks/time: whose items to return (LLM-provided). */
  assigneeScope?: "me" | "all" | "unassigned";
  /** For tasks: status filter (LLM-provided). */
  status?: "active" | "completed" | "overdue" | "all";
  /** For tasks: priority filter (LLM-provided). */
  priority?: "high" | "medium" | "low" | "all";
  /** Date range (YYYY-MM-DD), LLM-resolved. For time = log date; for tasks = due date. */
  dateFrom?: string;
  dateTo?: string;
  /** For time: only billable entries. */
  billableOnly?: boolean;
  /** Optional free-text search keywords (LLM-provided). */
  searchText?: string;
}

interface ResolvedTeamworkPerson {
  id: number;
  displayName: string;
  email: string;
}

async function resolveTeamworkPerson(siteUrl: string, apiToken: string, term: string, userId?: number): Promise<{ matches: ResolvedTeamworkPerson[]; lookupSucceeded: boolean }> {
  if (userId !== undefined) {
    const cached = getCachedNameResolution<{ matches: ResolvedTeamworkPerson[]; lookupSucceeded: boolean }>("teamwork", userId, term);
    if (cached) {
      console.log("[Teamwork] name resolution cache hit for", term);
      return cached;
    }
  }
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
    const result = { matches: filtered.length > 0 ? filtered : mapped, lookupSucceeded: true };
    if (userId !== undefined) {
      setCachedNameResolution("teamwork", userId, term, result);
    }
    return result;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      throw err;
    }
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

function createClient(siteUrl: string, accessToken: string) {
  const baseUrl = siteUrl.replace(/\/$/, "");
  return axios.create({
    baseURL: baseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 15000,
    maxRedirects: 0,
  });
}

async function fetchCurrentUserId(siteUrl: string, apiToken: string): Promise<number | null> {
  try {
    const client = createClient(siteUrl, apiToken);
    const response = await client.get("/me.json");
    const person = response.data?.person || response.data?.account || response.data;
    return (person?.id as number) || null;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      throw err;
    }
    return null;
  }
}

/** Builds Teamwork task query params purely from structured LLM-provided filters. */
function buildTaskParams(
  opts: TeamworkQueryOptions,
  currentUserId?: number | null,
  employeePersonId?: number,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "projects,assignees,taskLists,tags",
    orderBy: "dueDate",
    orderMode: "asc",
  };

  if (employeePersonId) {
    params["responsiblePartyIds"] = employeePersonId;
  } else if (opts.assigneeScope === "me") {
    if (currentUserId) {
      params["responsiblePartyIds"] = currentUserId;
    } else {
      params["assignedToMe"] = true;
    }
  }
  // "unassigned" / "all" need no special param beyond the defaults.

  if (opts.status === "completed") {
    params["includeCompletedTasks"] = true;
    params["completedOnly"] = true;
  } else if (opts.status === "overdue") {
    params["includeOverdueTasks"] = true;
    params["overdueOnly"] = true;
  } else if (opts.status === "active") {
    params["includeCompletedTasks"] = false;
  }

  if (opts.priority && opts.priority !== "all") {
    params["priority"] = opts.priority;
  }

  if (opts.dateFrom) params["dueDateFrom"] = opts.dateFrom;
  if (opts.dateTo) params["dueDateTo"] = opts.dateTo;

  if (opts.searchText) params["searchTerm"] = opts.searchText;

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

function mapTeamworkTask(t: Record<string, unknown>): TeamworkTask {
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
}

function mapTeamworkComment(c: Record<string, unknown>): TeamworkComment {
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
}

async function fetchTasks(siteUrl: string, apiToken: string, opts: TeamworkQueryOptions, currentUserId?: number | null, employeePersonId?: number): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const params = buildTaskParams(opts, currentUserId, employeePersonId);

  const response = await client.get("/projects/api/v3/tasks.json", { params });
  const tasks = response.data?.tasks || [];

  const mapped: TeamworkTask[] = tasks.slice(0, 25).map((t: Record<string, unknown>) => mapTeamworkTask(t));

  return { source: "live", type: "tasks", data: mapped, total: mapped.length };
}

async function fetchProjects(siteUrl: string, apiToken: string, opts: TeamworkQueryOptions): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    include: "companies,tags",
    orderBy: "lastActivityAt",
    orderMode: "desc",
  };

  if (opts.status === "active") {
    params["status"] = "active";
  } else if (opts.status === "completed") {
    params["status"] = "completed";
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

async function fetchTimeEntries(siteUrl: string, apiToken: string, opts: TeamworkQueryOptions, employeePersonId?: number): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  // Larger page so hour totals over a date range are accurate (not capped at 25).
  const params: Record<string, string | number | boolean> = {
    pageSize: 500,
    include: "tags",
  };

  if (employeePersonId) {
    params["userIds"] = employeePersonId;
  } else if (opts.assigneeScope === "me") {
    params["assignedToMe"] = true;
  }
  if (opts.billableOnly) {
    params["isBillable"] = true;
  }
  if (opts.dateFrom) params["startDate"] = opts.dateFrom;
  if (opts.dateTo) params["endDate"] = opts.dateTo;

  const response = await client.get("/projects/api/v3/time.json", { params });
  const entries = response.data?.timelogs || [];

  const mapped: TeamworkTimeEntry[] = entries.slice(0, 500).map((e: Record<string, unknown>) => {
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

  const mapped: TeamworkComment[] = comments.slice(0, 25).map((c: Record<string, unknown>) => mapTeamworkComment(c));

  return { source: "live", type: "comments", data: mapped, total: mapped.length };
}

async function fetchMessages(siteUrl: string, apiToken: string): Promise<TeamworkServiceResult> {
  const client = createClient(siteUrl, apiToken);
  const response = await client.get("/projects/api/v3/messages.json", {
    params: { pageSize: 25, orderBy: "createdAt", orderMode: "desc", include: "projects" },
  });
  const messages = response.data?.messages || response.data?.posts || [];

  const mapped: TeamworkMessage[] = messages.slice(0, 25).map((m: Record<string, unknown>) => {
    const project = m.project as Record<string, unknown> | undefined;
    const author = (m.author || m.postedBy || m.createdBy) as Record<string, unknown> | undefined;
    const rawBody = (m.body as string) || (m.htmlBody as string) || (m.contents as string) || "";
    return {
      id: (m.id as number) || 0,
      title: (m.title as string) || (m.subject as string) || "Untitled",
      body: rawBody.replace(/<[^>]+>/g, "").trim(),
      author: author ? extractPersonName(author) : "",
      postedAt: (m.postedDateTime as string) || (m.createdAt as string) || "",
      projectName: (project?.name as string) || "",
    };
  });

  return { source: "live", type: "messages", data: mapped, total: mapped.length };
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

  let apiToken: string;
  let siteUrl: string;
  try {
    const cred = await getTeamworkAccessToken(userId);
    if (!cred) {
      return { source: "not_connected", type: "tasks", data: [], total: 0 };
    }
    apiToken = cred.accessToken;
    siteUrl = cred.siteUrl;
  } catch (err) {
    if (err instanceof TeamworkPermissionError) {
      return {
        source: "error",
        type: "tasks",
        data: [],
        total: 0,
        message: err.message,
      };
    }
    throw err;
  }

  if (!isValidTeamworkUrl(siteUrl)) {
    return { source: "error", type: "tasks", data: [], total: 0, message: "Invalid Teamwork site URL" };
  }

  const category: TeamworkCategory = opts?.category || "tasks";
  const effectiveOpts: TeamworkQueryOptions = {
    ...opts,
    searchText: (query || "").trim() || undefined,
  };
  const needsMyUserId = category === "tasks" && opts?.assigneeScope === "me";
  const currentUserId = needsMyUserId ? await fetchCurrentUserId(siteUrl, apiToken) : null;

  let employeePersonId: number | undefined;
  let employeeContext: string | undefined;
  if (opts?.employee && opts.employee.trim()) {
    const term = opts.employee.trim();
    const { matches, lookupSucceeded } = await resolveTeamworkPerson(siteUrl, apiToken, term, userId);
    if (!lookupSucceeded) {
      return { source: "error", type: category, data: [], total: 0, message: `Could not look up Teamwork people. Your account may not have permission to view the people directory.` };
    }
    if (matches.length === 0) {
      return { source: "live", type: category, data: [], total: 0, instanceUrl: siteUrl, employeeMessage: `No Teamwork person matched "${term}" — they may not exist or your account may not have access to view them.` };
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
        result = await fetchProjects(siteUrl, apiToken, effectiveOpts);
        break;
      case "tasklists":
        result = await fetchTaskLists(siteUrl, apiToken);
        break;
      case "milestones":
        result = await fetchMilestones(siteUrl, apiToken);
        break;
      case "time":
        result = await fetchTimeEntries(siteUrl, apiToken, effectiveOpts, employeePersonId);
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
      case "messages":
        result = await fetchMessages(siteUrl, apiToken);
        break;
      case "tags":
        result = await fetchTags(siteUrl, apiToken);
        break;
      case "activity":
        result = await fetchActivity(siteUrl, apiToken);
        break;
      case "tasks":
      default:
        result = await fetchTasks(siteUrl, apiToken, effectiveOpts, currentUserId, employeePersonId);
        break;
    }
    result.instanceUrl = siteUrl;
    if (employeeContext) result.employeeContext = employeeContext;
    return result;
  } catch (error: unknown) {
    if (error instanceof TeamworkPermissionError) {
      return { source: "error", type: category, data: [], total: 0, message: error.message };
    }
    const status = (error as { response?: { status?: number } })?.response?.status;
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Teamwork API error:", msg);
    if (status === 401 || status === 403) {
      return {
        source: "error",
        type: category,
        data: [],
        total: 0,
        message: "Your Teamwork connection has expired or been revoked. Please reconnect Teamwork in Connected Services.",
      };
    }
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
    case "messages": {
      const messages = result.data as TeamworkMessage[];
      const lines = messages.map((m) => {
        let line = `• ${m.title}`;
        if (m.author) line += ` — ${m.author}`;
        if (m.postedAt) line += ` (${m.postedAt})`;
        if (m.projectName) line += ` | ${m.projectName}`;
        if (m.body) line += `\n  ${m.body.substring(0, 300)}${m.body.length > 300 ? "..." : ""}`;
        return line;
      });
      return `Teamwork messages (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
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

export interface TeamworkTaskDetail {
  task: TeamworkTask;
  comments: TeamworkComment[];
  instanceUrl: string;
}

export type TeamworkDetailResult =
  | { source: "live"; detail: TeamworkTaskDetail }
  | { source: "not_connected" }
  | { source: "error"; message: string };

export async function getTeamworkTaskDetail(userId: number, taskId: number): Promise<TeamworkDetailResult> {
  let apiToken: string;
  let siteUrl: string;
  try {
    const cred = await getTeamworkAccessToken(userId);
    if (!cred) return { source: "not_connected" };
    apiToken = cred.accessToken;
    siteUrl = cred.siteUrl;
  } catch (err) {
    if (err instanceof TeamworkPermissionError) return { source: "error", message: err.message };
    throw err;
  }

  if (!isValidTeamworkUrl(siteUrl)) {
    return { source: "error", message: "Invalid Teamwork site URL" };
  }

  const client = createClient(siteUrl, apiToken);

  try {
    const taskRes = await client.get(`/projects/api/v3/tasks/${taskId}.json`, {
      params: { include: "projects,assignees,taskLists,tags" },
    });
    const rawTask = taskRes.data?.task;
    if (!rawTask) {
      return { source: "error", message: "Task not found" };
    }
    const task = mapTeamworkTask(rawTask as Record<string, unknown>);

    let comments: TeamworkComment[] = [];
    try {
      const commentsRes = await client.get(`/projects/api/v3/tasks/${taskId}/comments.json`, {
        params: { pageSize: 50, orderBy: "createdAt", orderMode: "asc" },
      });
      const rawComments = commentsRes.data?.comments || [];
      comments = rawComments.map((c: Record<string, unknown>) => mapTeamworkComment(c));
    } catch (commentErr) {
      const msg = commentErr instanceof Error ? commentErr.message : String(commentErr);
      console.error("[Teamwork] Failed to load task comments:", msg);
    }

    return { source: "live", detail: { task, comments, instanceUrl: siteUrl } };
  } catch (error: unknown) {
    if (error instanceof TeamworkPermissionError) {
      return { source: "error", message: error.message };
    }
    const status = (error as { response?: { status?: number } })?.response?.status;
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Teamwork task detail error:", msg);
    if (status === 404) {
      return { source: "error", message: "Task not found" };
    }
    if (status === 401 || status === 403) {
      return { source: "error", message: "Your Teamwork connection has expired or been revoked. Please reconnect Teamwork in Connected Services." };
    }
    return { source: "error", message: "Failed to fetch task from Teamwork" };
  }
}
