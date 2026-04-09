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
  projectFilter?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const STS_DEFAULT_API = "https://time.scopicsoftware.com/stsapi";
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

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
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

  return { startISO: fmt(monday), endISO: fmt(sunday) };
}

interface DateRange {
  startISO: string;
  endISO: string;
}

function normalizeRange(range: DateRange): DateRange {
  if (range.startISO > range.endISO) {
    return { startISO: range.endISO, endISO: range.startISO };
  }
  return range;
}

function parseDateRange(query: string): DateRange {
  const lower = query.toLowerCase().trim();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const fromToMatch = lower.match(/(?:from\s+)?(\w+\s+\d{1,2})(?:,?\s*(\d{4}))?\s*(?:to|through|until|-)\s*(\w+\s+\d{1,2})(?:,?\s*(\d{4}))?/);
  if (fromToMatch) {
    const endYear = fromToMatch[4] ? parseInt(fromToMatch[4], 10) : now.getFullYear();
    const startYear = fromToMatch[2] ? parseInt(fromToMatch[2], 10) : endYear;
    const startDate = parseNamedDate(fromToMatch[1], startYear);
    const endDate = parseNamedDate(fromToMatch[3], endYear);
    if (startDate && endDate) {
      return normalizeRange({ startISO: fmt(startDate), endISO: fmt(endDate) });
    }
  }

  const fromToNumMatch = lower.match(/(?:from\s+)?(\d{1,2})\s*(?:to|through|until|-)\s*(\d{1,2})\s+(?:of\s+)?(\w+)(?:\s+(\d{4}))?/);
  if (fromToNumMatch) {
    const monthName = fromToNumMatch[3];
    const monthIdx = MONTH_MAP[monthName];
    if (monthIdx !== undefined) {
      const year = fromToNumMatch[4] ? parseInt(fromToNumMatch[4], 10) : now.getFullYear();
      const s = new Date(year, monthIdx, parseInt(fromToNumMatch[1], 10));
      const e = new Date(year, monthIdx, parseInt(fromToNumMatch[2], 10));
      return normalizeRange({ startISO: fmt(s), endISO: fmt(e) });
    }
  }

  if (/\bfrom\s+yesterday\s+(to|through|until)\s+today\b/.test(lower) || /\byesterday\s+(to|through|until)\s+today\b/.test(lower)) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { startISO: fmt(y), endISO: fmt(today) };
  }

  if (/\btoday\b/.test(lower) && !lower.includes("to ") && !lower.includes("from ")) {
    return { startISO: fmt(today), endISO: fmt(today) };
  }

  if (/\byesterday\b/.test(lower) && !lower.includes("to ") && !lower.includes("from ")) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { startISO: fmt(y), endISO: fmt(y) };
  }

  const lastNDaysMatch = lower.match(/(?:last|past)\s+(\d+)\s*days?/);
  if (lastNDaysMatch) {
    const n = parseInt(lastNDaysMatch[1], 10);
    const s = new Date(today);
    s.setDate(s.getDate() - n + 1);
    return { startISO: fmt(s), endISO: fmt(today) };
  }

  const lastNWeeksMatch = lower.match(/(?:last|past)\s+(\d+)\s*weeks?/);
  if (lastNWeeksMatch) {
    const n = parseInt(lastNWeeksMatch[1], 10);
    const s = new Date(today);
    s.setDate(s.getDate() - n * 7);
    return { startISO: fmt(s), endISO: fmt(today) };
  }

  const lastNMonthsMatch = lower.match(/(?:last|past)\s+(\d+)\s*months?/);
  if (lastNMonthsMatch) {
    const n = parseInt(lastNMonthsMatch[1], 10);
    const s = new Date(today);
    s.setMonth(s.getMonth() - n);
    return { startISO: fmt(s), endISO: fmt(today) };
  }

  const weeksAgoMatch = lower.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksAgoMatch) {
    const n = parseInt(weeksAgoMatch[1], 10);
    return getWeekRange(-n);
  }

  const monthsAgoMatch = lower.match(/(\d+)\s*months?\s*ago/);
  if (monthsAgoMatch) {
    const n = parseInt(monthsAgoMatch[1], 10);
    const target = new Date(now.getFullYear(), now.getMonth() - n, 1);
    const endOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    return { startISO: fmt(target), endISO: fmt(endOfMonth) };
  }

  if (lower.includes("this year")) {
    const s = new Date(now.getFullYear(), 0, 1);
    return { startISO: fmt(s), endISO: fmt(today) };
  }

  if (lower.includes("last year")) {
    const s = new Date(now.getFullYear() - 1, 0, 1);
    const e = new Date(now.getFullYear() - 1, 11, 31);
    return { startISO: fmt(s), endISO: fmt(e) };
  }

  if (lower.includes("this month")) {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startISO: fmt(s), endISO: fmt(today) };
  }

  if (/\blast\s+month\b/.test(lower) || /\bprevious\s+month\b/.test(lower)) {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startISO: fmt(s), endISO: fmt(e) };
  }

  for (const [name, idx] of Object.entries(MONTH_MAP)) {
    if (name.length < 3) continue;
    const monthYearMatch = lower.match(new RegExp("\\b" + name + "\\s+(20\\d{2})\\b"));
    if (monthYearMatch) {
      const y = parseInt(monthYearMatch[1], 10);
      const s = new Date(y, idx, 1);
      const e = new Date(y, idx + 1, 0);
      return { startISO: fmt(s), endISO: fmt(e) };
    }
  }

  for (const [name, idx] of Object.entries(MONTH_MAP)) {
    if (name.length < 3) continue;
    const namedDateMatch = lower.match(new RegExp("\\b" + name + "\\s+(\\d{1,2})\\b(?!\\s*(?:to|through|until|-))"));
    if (namedDateMatch) {
      const day = parseInt(namedDateMatch[1], 10);
      const y = idx < now.getMonth() || (idx === now.getMonth() && day <= now.getDate()) ? now.getFullYear() : now.getFullYear() - 1;
      const d = new Date(y, idx, day);
      return { startISO: fmt(d), endISO: fmt(d) };
    }
  }

  for (const [name, idx] of Object.entries(MONTH_MAP)) {
    if (name.length < 3) continue;
    const bareMonthMatch = lower.match(new RegExp("\\b(?:in\\s+)?" + name + "\\b(?!\\s+\\d)"));
    if (bareMonthMatch) {
      const y = idx <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1;
      const s = new Date(y, idx, 1);
      const e = new Date(y, idx + 1, 0);
      return { startISO: fmt(s), endISO: fmt(e) };
    }
  }

  const justYearMatch = lower.match(/\b(20\d{2})\b/);
  if (justYearMatch && !lower.match(new RegExp("\\b\\w+\\s+" + justYearMatch[1] + "\\b"))) {
    const y = parseInt(justYearMatch[1], 10);
    if (y !== now.getFullYear() || lower.includes("year")) {
      const s = new Date(y, 0, 1);
      const e = y === now.getFullYear() ? today : new Date(y, 11, 31);
      return { startISO: fmt(s), endISO: fmt(e) };
    }
  }

  if (lower.includes("last week") || lower.includes("previous week")) {
    return getWeekRange(-1);
  }
  if (lower.includes("next week")) {
    return getWeekRange(1);
  }

  return getWeekRange(0);
}

function parseNamedDate(text: string, fallbackYear: number): Date | null {
  const match = text.trim().match(/^(\w+)\s+(\d{1,2})$/);
  if (!match) return null;
  const monthIdx = MONTH_MAP[match[1].toLowerCase()];
  if (monthIdx === undefined) return null;
  return new Date(fallbackYear, monthIdx, parseInt(match[2], 10));
}

function extractProjectFilter(query: string): string | undefined {
  const quotedMatch = query.match(/(?:on|for|in)\s+(?:project\s+)?["']([^"']+)["']/i);
  if (quotedMatch && quotedMatch[1] && quotedMatch[1].trim().length > 1) {
    return quotedMatch[1].trim();
  }

  const TIME_WORDS = "this|last|next|in|from|during|for|since|today|yesterday|week|month|year|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const timePattern = new RegExp("\\s+(?:" + TIME_WORDS + "|\\d{4})(?:\\s|$)", "i");

  const onProjectMatch = query.match(/\b(?:on|for)\s+project\s+(.+)/i);
  if (onProjectMatch) {
    let rest = onProjectMatch[1].trim();
    const timeIdx = rest.search(timePattern);
    if (timeIdx > 0) {
      rest = rest.substring(0, timeIdx).trim();
    }
    if (rest.length > 1) return rest;
  }

  const onMatch = query.match(/\bon\s+([A-Z][A-Za-z0-9 _-]+?)(?:\s+(?:this|last|next|in|from|during|today|yesterday|week|month|year|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|\d{4})|$)/i);
  if (onMatch) {
    const candidate = onMatch[1].trim();
    const skipWords = new Set([
      "my", "the", "a", "this", "last", "next",
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
      "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
    ]);
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (candidate.length > 1 && !skipWords.has(candidate.toLowerCase()) && !skipWords.has(firstWord)) {
      return candidate;
    }
  }

  return undefined;
}

function filterEntriesByProject(entries: StsTimeEntry[], projectFilter: string): StsTimeEntry[] {
  const filterLower = projectFilter.toLowerCase();
  return entries.filter((e) => e.projectName.toLowerCase().includes(filterLower));
}

async function stsApiGet(
  apiUrl: string,
  endpoint: string,
  tokenId: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  const url = `${apiUrl}${endpoint}`;
  const queryParams: Record<string, string | number> = { ...params };

  console.log("[STS] API request:", url, "params:", JSON.stringify(queryParams));

  try {
    const response = await axios.get(url, {
      params: queryParams,
      timeout: 15000,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${tokenId}:x`).toString("base64")}`,
      },
    });
    console.log("[STS] Response status:", response.status, "data type:", typeof response.data, Array.isArray(response.data) ? `array(${response.data.length})` : "");
    return response.data;
  } catch (error: unknown) {
    const axErr = error as { response?: { status?: number; statusText?: string; data?: unknown }; message?: string };
    console.error("[STS] Request failed:", axErr.response?.status, axErr.response?.statusText);
    if (axErr.response?.data) {
      console.error("[STS] Response body:", JSON.stringify(axErr.response.data).substring(0, 500));
    }
    throw error;
  }
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

  const rawToken = cred.credentials.tokenId || cred.credentials.apiKey || cred.credentials.token || "";
  const tokenId = typeof rawToken === "string" ? rawToken.trim() : String(rawToken).trim();

  if (!tokenId) {
    return { ...emptyResult, source: "error", errorMessage: "STS token not configured. Please update your STS connection with your token." };
  }

  const apiUrl = resolveStsApiUrl(cred.instanceUrl);
  const { startISO, endISO } = parseDateRange(query);
  const projectFilter = extractProjectFilter(query);

  try {
    let rawEntries: any[] = [];
    let totalCount = 0;

    const firstData = await stsApiGet(apiUrl, "/time", tokenId);
    const fd = firstData as any;

    if (fd && typeof fd === "object" && !Array.isArray(fd) && (fd.code === 401 || fd.status === "Unauthorized" || (fd.message && String(fd.message).toLowerCase().includes("invalid token")))) {
      return { ...emptyResult, source: "error" as const, errorMessage: "STS token is invalid. Please update your token in Connected Services." };
    }

    if (fd && typeof fd === "object" && !Array.isArray(fd) && fd.code === 400) {
      return { ...emptyResult, source: "error" as const, errorMessage: "STS API request failed. Please check your connection settings." };
    }

    rawEntries = Array.isArray(firstData)
      ? firstData
      : (fd?.time || fd?.data || fd?.items || fd?.results || []);
    totalCount = parseInt(fd?.listcount || "0", 10);

    console.log("[STS] Page 1: got", rawEntries.length, "entries out of", totalCount, "total");
    console.log("[STS] Date range filter:", startISO, "to", endISO);
    console.log("[STS] Page 1 entries:", rawEntries.map((e: any) => `${e.dateiso}|${e.time}h|${e.project}`).join(" ; "));

    if (totalCount > rawEntries.length && rawEntries.length > 0) {
      let page = 2;
      let reachedPastRange = false;
      while (rawEntries.length < totalCount && page <= 100 && !reachedPastRange) {
        try {
          const moreData = await stsApiGet(apiUrl, "/time", tokenId, { page });
          const md = moreData as any;
          const moreEntries: any[] = Array.isArray(moreData)
            ? moreData
            : (md?.time || md?.data || md?.items || md?.results || []);
          if (moreEntries.length === 0) break;
          rawEntries = rawEntries.concat(moreEntries);

          const oldestDate = moreEntries.reduce((oldest: string, e: any) => {
            const d = e.dateiso || e.date || "";
            return d < oldest ? d : oldest;
          }, "9999-12-31");
          if (oldestDate < startISO) {
            reachedPastRange = true;
            console.log("[STS] Reached past range at page", page, "(oldest:", oldestDate, "< start:", startISO, "), stopping pagination. Total entries:", rawEntries.length);
          }

          page++;
        } catch (pageErr: any) {
          console.log("[STS] Pagination stopped at page", page, ":", pageErr?.response?.status || pageErr?.message);
          break;
        }
      }
    }

    let entries: StsTimeEntry[] = rawEntries.map((e: any) => ({
      id: parseInt(e.id || e.Id || "0", 10) || 0,
      date: e.dateiso || e.date || e.Date || e.workDate || "",
      hours: parseFloat(e.time || e.hours || e.Hours || e.duration || e.totalHours || "0"),
      projectName: e.project || e.projectName || e.ProjectName || e.project?.name || "Unknown",
      projectId: parseInt(e.projectid || e.projectId || e.ProjectId || e.project?.id || "0", 10) || 0,
      taskName: e.task || e.taskName || e.TaskName || e.task?.name || undefined,
      workType: e.worktype || e.workTypeName || e.WorkTypeName || undefined,
      description: e.description || e.Description || e.notes || undefined,
    }));

    entries = entries.filter((e) => {
      const dateStr = e.date.split("T")[0];
      return dateStr >= startISO && dateStr <= endISO;
    });

    if (projectFilter) {
      entries = filterEntriesByProject(entries, projectFilter);
    }

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

    const dayMap = new Map<string, number>();
    for (const entry of entries) {
      const dateStr = entry.date.split("T")[0];
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + entry.hours);
    }

    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    const daySpan = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const byDay: StsDaySummary[] = [];
    for (let i = 0; i < daySpan && i < 31; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = fmt(d);
      const hours = dayMap.get(dateStr) || 0;
      if (daySpan <= 14 || hours > 0) {
        byDay.push({
          date: dateStr,
          dayName: DAY_NAMES[d.getDay()],
          hours,
        });
      }
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
      projectFilter,
    };
  } catch (error: unknown) {
    const axErr = error as { response?: { status?: number; data?: { message?: string } }; code?: string; message?: string };
    const status = axErr.response?.status;
    const errMsg = (axErr.message || "").toLowerCase();
    const apiMessage = axErr.response?.data?.message || "";

    let errorMessage = "Failed to fetch STS data. Please check your token and try again.";
    if (status === 401 || status === 403) {
      errorMessage = apiMessage.toLowerCase().includes("invalid token")
        ? "STS token is invalid. Please update your token in Connected Services."
        : "STS token expired or unauthorized. Please update your token in Connected Services.";
    } else if (status === 404) {
      errorMessage = "STS API endpoint not found. Please verify your instance URL in Connected Services.";
    } else if (axErr.code === "ECONNREFUSED" || axErr.code === "ENOTFOUND") {
      errorMessage = "Cannot reach STS server. Please verify your instance URL in Connected Services.";
    } else if (axErr.code === "ETIMEDOUT" || axErr.code === "ECONNABORTED" || errMsg.includes("timeout")) {
      errorMessage = "STS server timed out. Please try again later.";
    }
    console.error("[STS] API error:", axErr.message || error);
    return { ...emptyResult, source: "error" as const, errorMessage };
  }
}

function getRangeLabel(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const daySpan = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (startISO === endISO) {
    return `${DAY_NAMES[start.getDay()]}, ${MONTH_NAMES[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  }

  if (start.getDate() === 1 && end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() && start.getMonth() === end.getMonth()) {
    return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  }

  if (start.getMonth() === 0 && start.getDate() === 1 && end.getMonth() === 11 && end.getDate() === 31 && start.getFullYear() === end.getFullYear()) {
    return `Year ${start.getFullYear()}`;
  }

  if (start.getMonth() === 0 && start.getDate() === 1 && start.getFullYear() === end.getFullYear()) {
    return `${start.getFullYear()} (Jan 1 — ${MONTH_NAMES[end.getMonth()]} ${end.getDate()})`;
  }

  if (daySpan === 7) {
    const dayOfWeek = start.getDay();
    const isMonday = dayOfWeek === 1;
    const endDayOfWeek = end.getDay();
    const isSunday = endDayOfWeek === 0;
    if (isMonday && isSunday) {
      return `Week of ${startISO} to ${endISO}`;
    }
  }

  return `${startISO} to ${endISO}`;
}

export function formatStsResult(result: StsWeekResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your STS account is not connected. Please go to Connected Services (Settings icon) to link your STS credentials.";
  }
  if (result.source === "error") {
    return result.errorMessage || "There was an error connecting to STS. Please check your credentials in Connected Services and try again.";
  }

  const rangeLabel = getRangeLabel(result.weekStart, result.weekEnd);
  const start = new Date(result.weekStart);
  const end = new Date(result.weekEnd);
  const daySpan = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const lines: string[] = [];
  let header = `STS Working Hours — ${rangeLabel}`;
  if (result.projectFilter) {
    header += ` (Project: ${result.projectFilter})`;
  }
  lines.push(header);
  lines.push(`Total: ${result.totalHours} hours`);
  lines.push("");

  if (daySpan > 60) {
    const monthMap = new Map<string, { sortKey: string; hours: number }>();
    for (const entry of result.entries) {
      const d = new Date(entry.date.split("T")[0]);
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const sortKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const existing = monthMap.get(label);
      monthMap.set(label, { sortKey, hours: (existing?.hours || 0) + entry.hours });
    }

    if (monthMap.size > 0) {
      const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey));
      lines.push("Monthly Breakdown:");
      for (const [month, { hours }] of sortedMonths) {
        const bar = hours > 0 ? ` (${"█".repeat(Math.min(Math.round(hours / 10), 20))})` : "";
        lines.push(`  ${month.padEnd(18)} ${hours.toFixed(1)}h${bar}`);
      }
    }
  } else if (daySpan > 14) {
    const weekMap = new Map<string, number>();
    for (const entry of result.entries) {
      const d = new Date(entry.date.split("T")[0]);
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      const key = fmt(monday);
      weekMap.set(key, (weekMap.get(key) || 0) + entry.hours);
    }

    if (weekMap.size > 0) {
      lines.push("Weekly Breakdown:");
      const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [weekStart, hours] of sortedWeeks) {
        const bar = hours > 0 ? ` (${"█".repeat(Math.min(Math.round(hours / 5), 20))})` : "";
        lines.push(`  Week of ${weekStart}  ${hours.toFixed(1)}h${bar}`);
      }
    }
  } else {
    if (result.byDay.length > 0) {
      lines.push("Daily Breakdown:");
      for (const day of result.byDay) {
        const bar = day.hours > 0 ? ` (${"█".repeat(Math.round(day.hours))})` : "";
        lines.push(`  ${day.dayName.padEnd(10)} ${day.date}  ${day.hours.toFixed(1)}h${bar}`);
      }
    }
  }

  if (result.byProject.length > 0 && !result.projectFilter) {
    lines.push("");
    lines.push("By Project:");
    for (const proj of result.byProject) {
      lines.push(`  • ${proj.projectName}: ${proj.hours.toFixed(1)}h`);
    }
  }

  if (result.entries.length > 0 && result.entries.length <= 50) {
    lines.push("");
    lines.push("Detailed Entries:");
    for (const entry of result.entries) {
      const parts = [`  ${entry.date.split("T")[0]} — ${entry.hours.toFixed(1)}h — ${entry.projectName}`];
      if (entry.taskName) parts[0] += ` / ${entry.taskName}`;
      if (entry.workType) parts[0] += ` [${entry.workType}]`;
      if (entry.description) parts[0] += ` — "${entry.description}"`;
      lines.push(parts[0]);
    }
  } else if (result.entries.length > 50) {
    lines.push("");
    lines.push(`(${result.entries.length} entries total — showing summary only)`);
  }

  lines.push("");
  lines.push(`Query: "${query}"`);

  return lines.join("\n");
}
