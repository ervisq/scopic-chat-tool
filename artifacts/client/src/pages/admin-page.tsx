import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RefreshCw, BarChart3, Users, Wrench } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AdminPageProps {
  onBack: () => void;
}

interface UsageEntry {
  user: string;
  tool: string | null;
  message: string;
  timestamp: string;
}

interface UsageData {
  log: UsageEntry[];
  stats: {
    totalMessages: number;
    byUser: Record<string, number>;
    byTool: Record<string, number>;
  };
}

const TOOL_COLORS: Record<string, string> = {
  JIRA: "#3b82f6",
  Zoho: "#f59e0b",
  STS: "#10b981",
};

const DEFAULT_COLOR = "#6b7280";

export default function AdminPage({ onBack }: AdminPageProps) {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/api/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch usage data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toolChartData = data
    ? Object.entries(data.stats.byTool).map(([name, count]) => ({
        name,
        count,
        fill: TOOL_COLORS[name] || DEFAULT_COLOR,
      }))
    : [];

  const userChartData = data
    ? Object.entries(data.stats.byUser).map(([name, count]) => ({
        name: name.length > 20 ? name.slice(0, 17) + "..." : name,
        count,
      }))
    : [];

  const timelineData = data
    ? buildTimeline(data.log)
    : [];

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-background z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Admin Dashboard</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={<BarChart3 className="w-4 h-4" />}
              label="Total Queries"
              value={data?.stats.totalMessages ?? 0}
            />
            <StatCard
              icon={<Wrench className="w-4 h-4" />}
              label="Tools Used"
              value={Object.keys(data?.stats.byTool ?? {}).length}
            />
            <StatCard
              icon={<Users className="w-4 h-4" />}
              label="Active Users"
              value={Object.keys(data?.stats.byUser ?? {}).length}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Queries per Tool</h2>
              {toolChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={toolChartData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {toolChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No tool usage yet" />
              )}
            </div>

            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Queries per User</h2>
              {userChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={userChartData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No user activity yet" />
              )}
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Activity Over Time</h2>
            {timelineData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="Need more data for timeline" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function buildTimeline(log: UsageEntry[]) {
  const buckets: Record<string, number> = {};
  for (const entry of log) {
    const d = new Date(entry.timestamp);
    const key = `${d.getHours().toString().padStart(2, "0")}:${(Math.floor(d.getMinutes() / 5) * 5).toString().padStart(2, "0")}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }));
}
