export interface UsageEntry {
  user: string;
  tool: string | null;
  message: string;
  timestamp: string;
}

export type Range = "today" | "week" | "month" | "quarter" | "year";

export const ALL_RANGES: Range[] = ["today", "week", "month", "quarter", "year"];

const usageLog: UsageEntry[] = [];

export function trackUsage(user: string, tool: string | null, message: string): void {
  usageLog.push({
    user,
    tool,
    message,
    timestamp: new Date().toISOString(),
  });
}

export function getRangeStart(range: Range, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  switch (range) {
    case "today":
      return d;
    case "week": {
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      d.setDate(d.getDate() + diff);
      return d;
    }
    case "month":
      d.setDate(1);
      return d;
    case "quarter": {
      const m = d.getMonth();
      const qStart = m - (m % 3);
      d.setMonth(qStart, 1);
      return d;
    }
    case "year":
      d.setMonth(0, 1);
      return d;
  }
}

function filterByRange(entries: UsageEntry[], range?: Range): UsageEntry[] {
  if (!range) return entries;
  const start = getRangeStart(range).getTime();
  return entries.filter((e) => new Date(e.timestamp).getTime() >= start);
}

export function getUsageLog(range?: Range): UsageEntry[] {
  return filterByRange(usageLog, range);
}

export function getUsageStats(range?: Range): {
  totalMessages: number;
  byUser: Record<string, number>;
  byTool: Record<string, number>;
} {
  const byUser: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  const entries = filterByRange(usageLog, range);

  for (const entry of entries) {
    byUser[entry.user] = (byUser[entry.user] || 0) + 1;
    if (entry.tool) {
      byTool[entry.tool] = (byTool[entry.tool] || 0) + 1;
    }
  }

  return { totalMessages: entries.length, byUser, byTool };
}
