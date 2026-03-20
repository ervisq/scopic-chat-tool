import axios from "axios";
import { getUserCredentials } from "../lib/credential-store";

export interface StsTimeEntry {
  id: number;
  date: string;
  hours: number;
  projectName: string;
  projectId: number;
  taskName?: string;
  workType?: string;
  description?: string;
}

export interface StsDaySummary {
  date: string;
  dayName: string;
  hours: number;
}

export interface StsWeekResult {
  entries: StsTimeEntry[];
  totalHours: number;
  byDay: StsDaySummary[];
  byProject: { projectName: string; hours: number }[];
  weekStart: string;
  weekEnd: string;
  source: "live" | "not_connected" | "error";
  errorMessage?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STS_DEFAULT_API = "https://time.scopicsoftware.com/stsapi";
const STS_FALLBACK_API = "https://api-tt.scopicsoftware.com/stsapi";
const STS_ALLOWED_HOSTS = ["time.scopicsoftware.com", "api-tt.scopicsoftware.com"];

function resolveStsApiUrl(instanceUrl?: string | null): string {
  if (!instanceUrl) return STS_DEFAULT_API;

  try {
    const parsed = new URL(instanceUrl);
    if (parsed.protocol !== "https:") return STS_DEFAULT_API;
    if (!STS_ALLOWED_HOSTS.includes(parsed.hostname)) return STS_DEFAULT_API;

    const base = instanceUrl.replace(/\/+$/, "");
    if (base.includes("/stsapi")) return base;
    return `${base}/stsapi`;
  } catch {
    return STS_DEFAULT_API;
  }
}

function getWeekRange(weekOffset: number = 0): { startISO: string; endISO: string } {
  const now = new Date();
  now.setDate(now.getDate() + weekOffset * 7);

  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { startISO: fmt(monday), endISO: fmt(sunday) };
}

async function stsApiGet(
  apiUrl: string,
  endpoint: string,
  token: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  const url = `${apiUrl}${endpoint}`;
  const queryParams = {
    ...params,
    "token[token_id]": token,
    limit: params.limit ?? 0,
    offset: params.offset ?? 0,
  };

  const response = await axios.get(url, {
    params: queryParams,
    timeout: 15000,
    headers: {
      Accept: "application/json",
    },
  });

  return response.data;
}

function parseWeekOffset(query: string): number {
  const lower = query.toLowerCase();
  if (lower.includes("last week") || lower.includes("previous week")) return -1;
  if (lower.includes("next week")) return 1;
  return 0;
}

export async function querySts(query: string, userId?: number): Promise<StsWeekResult> {
  const emptyResult: StsWeekResult = {
    entries: [],
    totalHours: 0,
    byDay: [],
    byProject: [],
    weekStart: "",
    weekEnd: "",
    source: "not_connected",
  };

  if (!userId) return emptyResult;

  const cred = await getUserCredentials(userId, "sts");
  if (!cred) return emptyResult;

  const tokenId = cred.credentials.tokenId || cred.credentials.apiKey;

  if (!tokenId) {
    return { ...emptyResult, source: "error", errorMessage: "STS token not configured. Please update your STS connection with your token." };
  }

  const primaryApi = resolveStsApiUrl(cred.instanceUrl);
  const weekOffset = parseWeekOffset(query);
  const { startISO, endISO } = getWeekRange(weekOffset);

  const apiUrls = [primaryApi];
  if (primaryApi !== STS_FALLBACK_API) {
    apiUrls.push(STS_FALLBACK_API);
  }

  for (const apiUrl of apiUrls) {
    try {
      const timeData = await stsApiGet(apiUrl, "/time", tokenId, {
        startDate: startISO,
        endDate: endISO,
      });

      const rawEntries: any[] = Array.isArray(timeData) ? timeData : (timeData?.data || timeData?.items || timeData?.results || []);

      const entries: StsTimeEntry[] = rawEntries.map((e: any) => ({
        id: e.id || e.Id || 0,
        date: e.date || e.Date || e.workDate || "",
        hours: parseFloat(e.hours || e.Hours || e.duration || e.totalHours || "0"),
        projectName: e.projectName || e.ProjectName || e.project?.name || e.project || "Unknown",
        projectId: e.projectId || e.ProjectId || e.project?.id || 0,
        taskName: e.taskName || e.TaskName || e.task?.name || e.task || undefined,
        workType: e.workTypeName || e.WorkTypeName || e.workType || undefined,
        description: e.description || e.Description || e.notes || undefined,
      }));

      const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

      const dayMap = new Map<string, number>();
      for (const entry of entries) {
        const dateStr = entry.date.split("T")[0];
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + entry.hours);
      }

      const byDay: StsDaySummary[] = [];
      const start = new Date(startISO);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        byDay.push({
          date: dateStr,
          dayName: DAY_NAMES[d.getDay()],
          hours: dayMap.get(dateStr) || 0,
        });
      }

      const projectMap = new Map<string, number>();
      for (const entry of entries) {
        projectMap.set(entry.projectName, (projectMap.get(entry.projectName) || 0) + entry.hours);
      }
      const byProject = Array.from(projectMap.entries())
        .map(([projectName, hours]) => ({ projectName, hours }))
        .sort((a, b) => b.hours - a.hours);

      return {
        entries,
        totalHours: Math.round(totalHours * 100) / 100,
        byDay,
        byProject,
        weekStart: startISO,
        weekEnd: endISO,
        source: "live" as const,
      };
    } catch (error: any) {
      const status = error?.response?.status;
      const isConnectionError = error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || (status && status >= 500);

      if (isConnectionError && apiUrl !== apiUrls[apiUrls.length - 1]) {
        console.warn(`STS primary API (${apiUrl}) failed, trying fallback...`);
        continue;
      }

      let errorMessage = "Failed to fetch STS data. Please check your token and try again.";
      if (status === 401 || status === 403) {
        errorMessage = "STS token expired or invalid. Please update your token in Connected Services.";
      } else if (status === 404) {
        errorMessage = "STS API endpoint not found. Please verify your instance URL in Connected Services.";
      } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        errorMessage = "Cannot reach STS server. Please verify your instance URL in Connected Services.";
      }
      console.error("STS API error:", error?.message || error);
      return { ...emptyResult, source: "error" as const, errorMessage };
    }
  }

  return { ...emptyResult, source: "error" as const, errorMessage: "Failed to connect to STS. Please try again later." };
}

export function formatStsResult(result: StsWeekResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your STS account is not connected. Please go to Connected Services (Settings icon) to link your STS credentials.";
  }
  if (result.source === "error") {
    return result.errorMessage || "There was an error connecting to STS. Please check your credentials in Connected Services and try again.";
  }

  const lines: string[] = [];
  lines.push(`STS Working Hours — Week of ${result.weekStart} to ${result.weekEnd}`);
  lines.push(`Total: ${result.totalHours} hours`);
  lines.push("");

  lines.push("Daily Breakdown:");
  for (const day of result.byDay) {
    const bar = day.hours > 0 ? ` (${"█".repeat(Math.round(day.hours))})` : "";
    lines.push(`  ${day.dayName.padEnd(10)} ${day.hours.toFixed(1)}h${bar}`);
  }

  if (result.byProject.length > 0) {
    lines.push("");
    lines.push("By Project:");
    for (const proj of result.byProject) {
      lines.push(`  • ${proj.projectName}: ${proj.hours.toFixed(1)}h`);
    }
  }

  if (result.entries.length > 0) {
    lines.push("");
    lines.push("Detailed Entries:");
    for (const entry of result.entries) {
      const parts = [`  ${entry.date.split("T")[0]} — ${entry.hours.toFixed(1)}h — ${entry.projectName}`];
      if (entry.taskName) parts[0] += ` / ${entry.taskName}`;
      if (entry.workType) parts[0] += ` [${entry.workType}]`;
      if (entry.description) parts[0] += ` — "${entry.description}"`;
      lines.push(parts[0]);
    }
  }

  lines.push("");
  lines.push(`Query: "${query}"`);

  return lines.join("\n");
}
