export interface UsageEntry {
  user: string;
  tool: string | null;
  message: string;
  timestamp: string;
}

const usageLog: UsageEntry[] = [];

export function trackUsage(user: string, tool: string | null, message: string): void {
  usageLog.push({
    user,
    tool,
    message,
    timestamp: new Date().toISOString(),
  });
}

export function getUsageLog(): UsageEntry[] {
  return usageLog;
}

export function getUsageStats(): {
  totalMessages: number;
  byUser: Record<string, number>;
  byTool: Record<string, number>;
} {
  const byUser: Record<string, number> = {};
  const byTool: Record<string, number> = {};

  for (const entry of usageLog) {
    byUser[entry.user] = (byUser[entry.user] || 0) + 1;
    if (entry.tool) {
      byTool[entry.tool] = (byTool[entry.tool] || 0) + 1;
    }
  }

  return { totalMessages: usageLog.length, byUser, byTool };
}
