import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, BarChart3, Users, Shield, Search, ChevronDown, AlertTriangle, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AdminPageProps {
  userRole?: string;
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

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const TOOL_COLORS: Record<string, string> = {
  JIRA: "#3b82f6",
  Zoho: "#f59e0b",
  STS: "#10b981",
  Teamwork: "#8b5cf6",
};

const DEFAULT_COLOR = "#6b7280";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  user: "User",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  user: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

type Tab = "users" | "usage" | "signups";

interface FailedSignupEntry {
  timestamp: string;
  redactedEmail: string;
  reason: string;
  ip: string;
}
type Range = "today" | "week" | "month" | "quarter" | "year";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

const RANGE_LABELS: Record<Range, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  quarter: "this quarter",
  year: "this year",
};

export default function AdminPage({ userRole }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageRange, setUsageRange] = useState<Range>("today");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [failedSignups, setFailedSignups] = useState<FailedSignupEntry[]>([]);
  const [failedSignupsLoading, setFailedSignupsLoading] = useState(false);

  const isAdmin = userRole === "admin";

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setManagedUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchUsage = useCallback(async (range: Range) => {
    setUsageLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/api/admin/usage?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsageData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch usage data:", err);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (activeTab === "usage") {
      fetchUsage(usageRange);
    }
  }, [activeTab, usageRange, fetchUsage]);

  const fetchFailedSignups = useCallback(async () => {
    setFailedSignupsLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/api/admin/failed-signups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFailedSignups(data.entries || []);
      }
    } catch (err) {
      console.error("Failed to fetch failed sign-ups:", err);
    } finally {
      setFailedSignupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "signups") {
      fetchFailedSignups();
    }
  }, [activeTab, fetchFailedSignups]);

  const handleRoleChange = useCallback(async (userId: number, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${baseUrl}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setManagedUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: data.user.role } : u))
        );
      } else {
        const err = await res.json();
        alert(err.message || "Failed to update role");
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setUpdatingUserId(null);
    }
  }, []);

  const filteredUsers = useMemo(() => {
    return managedUsers.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [managedUsers, searchQuery, roleFilter]);

  const roleCounts = useMemo(() => {
    const counts = { admin: 0, user: 0 };
    for (const u of managedUsers) {
      if (u.role in counts) counts[u.role as keyof typeof counts]++;
    }
    return counts;
  }, [managedUsers]);

  if (accessDenied) {
    return (
      <div className="flex flex-col h-dvh bg-background items-center justify-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Access Denied</h1>
        <p className="text-sm text-muted-foreground">You need admin privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-background z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "users"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab("usage")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "usage"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Usage
            </button>
            <button
              onClick={() => setActiveTab("signups")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "signups"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign-up Issues
            </button>
          </div>
        </div>
        <button
          onClick={
            activeTab === "users"
              ? fetchUsers
              : activeTab === "usage"
              ? () => fetchUsage(usageRange)
              : fetchFailedSignups
          }
          disabled={
            activeTab === "users"
              ? usersLoading
              : activeTab === "usage"
              ? usageLoading
              : failedSignupsLoading
          }
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              (activeTab === "users"
                ? usersLoading
                : activeTab === "usage"
                ? usageLoading
                : failedSignupsLoading)
                ? "animate-spin"
                : ""
            }`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          {activeTab === "users" ? (
            <UsersTab
              users={filteredUsers}
              loading={usersLoading}
              isAdmin={isAdmin}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              roleFilter={roleFilter}
              onRoleFilterChange={setRoleFilter}
              onRoleChange={handleRoleChange}
              updatingUserId={updatingUserId}
              roleCounts={roleCounts}
              totalCount={managedUsers.length}
            />
          ) : activeTab === "usage" ? (
            <UsageTab
              data={usageData}
              loading={usageLoading}
              range={usageRange}
              onRangeChange={setUsageRange}
            />
          ) : (
            <FailedSignupsTab entries={failedSignups} loading={failedSignupsLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

function UsersTab({
  users,
  loading,
  isAdmin,
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  onRoleChange,
  updatingUserId,
  roleCounts,
  totalCount,
}: {
  users: ManagedUser[];
  loading: boolean;
  isAdmin: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  roleFilter: string;
  onRoleFilterChange: (r: string) => void;
  onRoleChange: (id: number, role: string) => void;
  updatingUserId: number | null;
  roleCounts: { admin: number; user: number };
  totalCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={totalCount} />
        <StatCard icon={<Shield className="w-4 h-4 text-amber-500" />} label="Admin" value={roleCounts.admin} />
        <StatCard icon={<Users className="w-4 h-4 text-gray-500" />} label="Users" value={roleCounts.user} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-card border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{u.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{u.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && u.email.toLowerCase() !== "ervis.q@scopicsoftware.com" ? (
                        <div className="relative inline-block">
                          <select
                            value={u.role}
                            onChange={(e) => onRoleChange(u.id, e.target.value)}
                            disabled={updatingUserId === u.id}
                            className={`appearance-none text-xs font-medium px-2.5 py-1 pr-6 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                              ROLE_COLORS[u.role] || ROLE_COLORS.user
                            } ${updatingUserId === u.id ? "opacity-50" : ""}`}
                          >
                            <option value="user">User</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                        </div>
                      ) : (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsageTab({
  data,
  loading,
  range,
  onRangeChange,
}: {
  data: UsageData | null;
  loading: boolean;
  range: Range;
  onRangeChange: (r: Range) => void;
}) {
  const rangeLabel = RANGE_LABELS[range];
  const showLoadingOverlay = loading && !data;

  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const allUsersInRange = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const e of data.log) set.add(e.user);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const userMatches = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return allUsersInRange.slice(0, 8);
    return allUsersInRange.filter((u) => u.toLowerCase().includes(q)).slice(0, 8);
  }, [userQuery, allUsersInRange]);

  const filteredLog = useMemo(() => {
    if (!data) return [];
    if (!selectedUser) return data.log;
    return data.log.filter((e) => e.user === selectedUser);
  }, [data, selectedUser]);

  const totalQueries = filteredLog.length;

  const toolChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of filteredLog) {
      if (e.tool) counts[e.tool] = (counts[e.tool] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        fill: TOOL_COLORS[name] || DEFAULT_COLOR,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredLog]);

  function handlePickUser(u: string) {
    setSelectedUser(u);
    setUserQuery(u);
    setDropdownOpen(false);
  }

  function handleClearUser() {
    setSelectedUser(null);
    setUserQuery("");
    setDropdownOpen(false);
  }

  const chartTitle = selectedUser
    ? `Queries per Tool — ${selectedUser}`
    : "Queries per Tool";
  const emptyLabel = selectedUser
    ? `No tool usage for ${selectedUser} ${rangeLabel}`
    : `No tool usage ${rangeLabel}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 rounded-lg p-1 w-fit">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onRangeChange(opt.value)}
            disabled={loading && opt.value === range}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              range === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {loading && (
          <div className="w-3 h-3 ml-1 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {showLoadingOverlay ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              icon={<BarChart3 className="w-4 h-4" />}
              label={selectedUser ? `Total Queries — ${selectedUser}` : "Total Queries"}
              value={totalQueries}
            />
            <div ref={searchRef} className="relative bg-card border border-border/60 rounded-xl p-4">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Search className="w-4 h-4" />
                Filter by user
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userQuery}
                  placeholder="Search by name or email…"
                  onChange={(e) => {
                    setUserQuery(e.target.value);
                    setDropdownOpen(true);
                    if (selectedUser && e.target.value !== selectedUser) {
                      setSelectedUser(null);
                    }
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  className="w-full text-sm bg-background border border-border/60 rounded-md pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {(userQuery || selectedUser) && (
                  <button
                    type="button"
                    onClick={handleClearUser}
                    aria-label="Clear user filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {dropdownOpen && userMatches.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-1 z-10 max-h-56 overflow-y-auto bg-popover border border-border/60 rounded-md shadow-lg">
                    {userMatches.map((u) => (
                      <li key={u}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handlePickUser(u)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                        >
                          {u}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {dropdownOpen && allUsersInRange.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-popover border border-border/60 rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
                    No users with activity {rangeLabel}.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">{chartTitle}</h2>
            {toolChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={toolChartData} barSize={48}>
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
              <EmptyChart label={emptyLabel} />
            )}
          </div>
        </>
      )}
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

function FailedSignupsTab({
  entries,
  loading,
}: {
  entries: FailedSignupEntry[];
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border/60 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">Recent sign-up issues</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          The last {entries.length > 0 ? entries.length : "50"} rejected sign-up attempts (newest first). Resets when the server restarts.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">When</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Reason</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                    No failed sign-up attempts recorded.
                  </td>
                </tr>
              ) : (
                entries.map((e, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground font-mono">{e.redactedEmail}</td>
                    <td className="px-3 py-2 text-sm text-foreground">{e.reason}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{e.ip}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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

