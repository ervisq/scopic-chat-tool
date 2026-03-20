import { useState, useEffect } from "react";
import {
  MessageSquare,
  Settings,
  LogOut,
  ExternalLink,
  Loader2,
  Link2,
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  Shield,
} from "lucide-react";

interface DashboardPageProps {
  user: { email: string; name: string } | null;
  token: string | null;
  onLogout: () => void;
  onOpenChat: () => void;
  onOpenAdmin: () => void;
  onOpenConnections: () => void;
}

interface JiraTicketSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface ServiceData {
  key: string;
  name: string;
  connected: boolean;
  instanceUrl?: string | null;
  summary?: {
    totalTickets?: number;
    openTickets?: number;
    tickets?: JiraTicketSummary[];
    status?: string;
  };
  error?: string;
}

const SERVICE_STYLES: Record<
  string,
  { color: string; bgColor: string; textColor: string; borderColor: string; icon: string }
> = {
  jira: {
    color: "bg-blue-500",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/20",
    icon: "JI",
  },
  zoho_people: {
    color: "bg-amber-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/20",
    icon: "ZP",
  },
  zoho_crm: {
    color: "bg-orange-500",
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/20",
    icon: "ZC",
  },
  sts: {
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/20",
    icon: "ST",
  },
};

const EXTERNAL_URLS: Record<string, (instanceUrl?: string | null) => string> = {
  jira: (instanceUrl) => instanceUrl || "https://www.atlassian.com/software/jira",
  zoho_people: () => "https://people.zoho.com",
  zoho_crm: () => "https://crm.zoho.com",
  sts: (instanceUrl) => instanceUrl || "#",
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "To Do": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  };
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors[status] || "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Highest: "bg-red-500",
    High: "bg-orange-500",
    Medium: "bg-yellow-500",
    Low: "bg-blue-400",
    Lowest: "bg-slate-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[priority] || "bg-muted-foreground"}`}
      title={priority}
    />
  );
}

function ServiceCard({
  service,
  onConnect,
}: {
  service: ServiceData;
  onConnect: () => void;
}) {
  const style = SERVICE_STYLES[service.key] || SERVICE_STYLES.jira;
  const externalUrl = EXTERNAL_URLS[service.key]?.(service.instanceUrl) || "#";

  return (
    <div
      className={`rounded-2xl border ${style.borderColor} bg-card overflow-hidden transition-all hover:shadow-md`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl ${style.color} flex items-center justify-center shadow-sm`}
            >
              <span className="text-white text-xs font-bold tracking-wider">
                {style.icon}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-[15px]">
                {service.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {service.connected ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Connected
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Not connected
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {service.connected ? (
          <div className="space-y-3">
            {service.error && (
              <p className="text-xs text-muted-foreground italic">
                {service.error}
              </p>
            )}

            {service.key === "jira" && service.summary?.tickets && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Your Tasks
                  </p>
                  {service.summary.openTickets !== undefined && (
                    <span className={`text-xs font-semibold ${style.textColor}`}>
                      {service.summary.openTickets} open
                    </span>
                  )}
                </div>
                {service.summary.tickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tasks found
                  </p>
                ) : (
                  service.summary.tickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/30"
                    >
                      <PriorityDot priority={t.priority} />
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {t.id}
                      </span>
                      <span className="text-xs text-foreground truncate flex-1">
                        {t.title}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                  ))
                )}
              </div>
            )}

            {(service.key === "zoho_people" ||
              service.key === "zoho_crm" ||
              service.key === "sts") &&
              service.summary?.status && (
                <div
                  className={`rounded-lg ${style.bgColor} px-3 py-2`}
                >
                  <p className={`text-xs font-medium ${style.textColor}`}>
                    {service.summary.status}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Use{" "}
                    <span className="font-mono font-semibold">
                      @
                      {service.key === "zoho_people"
                        ? "ZohoPeople"
                        : service.key === "zoho_crm"
                          ? "ZohoCRM"
                          : "STS"}
                    </span>{" "}
                    in chat to query data
                  </p>
                </div>
              )}

            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${style.bgColor} ${style.textColor} hover:opacity-80`}
            >
              Open {service.name}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Connect your {service.name} account to see your data here and use
              it in chat.
            </p>
            <button
              onClick={onConnect}
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${style.color} text-white hover:opacity-90`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Connect {service.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage({
  user,
  token,
  onLogout,
  onOpenChat,
  onOpenAdmin,
  onOpenConnections,
}: DashboardPageProps) {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const connectedCount = services.filter((s) => s.connected).length;

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-background z-10">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Dashboard</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Chat"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chat</span>
          </button>
          <button
            onClick={onOpenConnections}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Connections"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Services</span>
          </button>
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Admin"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </button>
          <div className="w-px h-5 bg-border/50 mx-1" />
          <span className="text-xs text-muted-foreground hidden sm:inline mr-1">
            {user?.name || user?.email}
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              Welcome back, {user?.name || "there"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {connectedCount > 0
                ? `${connectedCount} service${connectedCount !== 1 ? "s" : ""} connected`
                : "Connect your services to get started"}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-5">
              {services.map((service) => (
                <ServiceCard
                  key={service.key}
                  service={service}
                  onConnect={onOpenConnections}
                />
              ))}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              onClick={onOpenChat}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Open AI Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
