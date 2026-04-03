import { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  ExternalLink,
  Loader2,
  Link2,
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  Mail,
  Calendar,
  Paperclip,
  MapPin,
  Filter,
} from "lucide-react";

interface DashboardPageProps {
  user: { email: string; name: string } | null;
  token: string | null;
  onOpenChat: () => void;
  onOpenConnections: () => void;
}

interface JiraTicketSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  project: string;
}

interface StsProjectSummary {
  name: string;
  hours: number;
}

interface OutlookEmailSummary {
  subject: string;
  from: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
}

interface OutlookEventSummary {
  subject: string;
  startTime: string;
  endTime: string;
  location: string;
  isAllDay: boolean;
}

interface TeamworkTaskSummary {
  id: number;
  title: string;
  status: string;
  priority: string;
  projectName: string;
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
    totalTasks?: number;
    activeTasks?: number;
    tasks?: TeamworkTaskSummary[];
    totalHours?: number;
    weekStart?: string;
    weekEnd?: string;
    daysSummary?: string;
    byProject?: StsProjectSummary[];
    emails?: OutlookEmailSummary[];
    events?: OutlookEventSummary[];
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
  teamwork: {
    color: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/20",
    icon: "TW",
  },
  outlook_email: {
    color: "bg-sky-500",
    bgColor: "bg-sky-500/10",
    textColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-500/20",
    icon: "OE",
  },
  outlook_calendar: {
    color: "bg-indigo-500",
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-indigo-500/20",
    icon: "OC",
  },
};

const EXTERNAL_URLS: Record<string, (instanceUrl?: string | null) => string> = {
  jira: (instanceUrl) => instanceUrl || "https://www.atlassian.com/software/jira",
  zoho_people: () => "https://people.zoho.com",
  zoho_crm: () => "https://crm.zoho.com",
  sts: (instanceUrl) => instanceUrl || "https://time.scopicsoftware.com",
  teamwork: (instanceUrl) => instanceUrl || "https://www.teamwork.com",
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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatEventDateTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatEventTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " (All Day)";
}

function ProjectFilter({
  projects,
  selected,
  onChange,
  accentColor,
}: {
  projects: string[];
  selected: string;
  onChange: (val: string) => void;
  accentColor: string;
}) {
  if (projects.length <= 1) return null;
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Filter className={`w-3 h-3 ${accentColor} shrink-0`} />
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] bg-muted/40 border border-border/50 rounded-md px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 truncate max-w-[180px]"
      >
        <option value="">All Projects</option>
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
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
  const [projectFilter, setProjectFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const DISPLAY_LIMIT = 5;

  const jiraProjects = useMemo(() =>
    service.key === "jira" && service.summary?.tickets
      ? [...new Set(service.summary.tickets.map((t) => t.project).filter(Boolean))].sort()
      : [],
    [service.key, service.summary?.tickets]
  );

  const teamworkProjects = useMemo(() =>
    service.key === "teamwork" && service.summary?.tasks
      ? [...new Set(service.summary.tasks.map((t) => t.projectName).filter(Boolean))].sort()
      : [],
    [service.key, service.summary?.tasks]
  );

  const stsProjects = useMemo(() =>
    service.key === "sts" && service.summary?.byProject
      ? [...new Set(service.summary.byProject.map((p) => p.name).filter(Boolean))].sort()
      : [],
    [service.key, service.summary?.byProject]
  );

  const availableProjects = jiraProjects.length > 0 ? jiraProjects : teamworkProjects.length > 0 ? teamworkProjects : stsProjects;
  useEffect(() => {
    if (projectFilter && !availableProjects.includes(projectFilter)) {
      setProjectFilter("");
    }
  }, [availableProjects, projectFilter]);

  const filteredJiraTickets = service.summary?.tickets
    ? (projectFilter ? service.summary.tickets.filter((t) => t.project === projectFilter) : service.summary.tickets)
    : [];

  const filteredTeamworkTasks = service.summary?.tasks
    ? (projectFilter ? service.summary.tasks.filter((t) => t.projectName === projectFilter) : service.summary.tasks)
    : [];

  const filteredStsProjects = service.summary?.byProject
    ? (projectFilter ? service.summary.byProject.filter((p) => p.name === projectFilter) : service.summary.byProject)
    : [];

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
                <ProjectFilter
                  projects={jiraProjects}
                  selected={projectFilter}
                  onChange={setProjectFilter}
                  accentColor={style.textColor}
                />
                {filteredJiraTickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {projectFilter ? "No tasks in this project" : "No tasks found"}
                  </p>
                ) : (
                  <>
                    {(expanded ? filteredJiraTickets : filteredJiraTickets.slice(0, DISPLAY_LIMIT)).map((t) => (
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
                    ))}
                    {filteredJiraTickets.length > DISPLAY_LIMIT && (
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className={`text-[11px] font-medium ${style.textColor} hover:underline`}
                      >
                        {expanded ? "Show less" : `Show all ${filteredJiraTickets.length} tasks`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {service.key === "teamwork" && service.summary?.tasks && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Your Tasks
                  </p>
                  {service.summary.activeTasks !== undefined && (
                    <span className={`text-xs font-semibold ${style.textColor}`}>
                      {service.summary.activeTasks} active
                    </span>
                  )}
                </div>
                <ProjectFilter
                  projects={teamworkProjects}
                  selected={projectFilter}
                  onChange={setProjectFilter}
                  accentColor={style.textColor}
                />
                {filteredTeamworkTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {projectFilter ? "No tasks in this project" : "No tasks found"}
                  </p>
                ) : (
                  <>
                    {(expanded ? filteredTeamworkTasks : filteredTeamworkTasks.slice(0, DISPLAY_LIMIT)).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/30"
                      >
                        <PriorityDot priority={t.priority} />
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          #{t.id}
                        </span>
                        <span className="text-xs text-foreground truncate flex-1">
                          {t.title}
                        </span>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                    {filteredTeamworkTasks.length > DISPLAY_LIMIT && (
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className={`text-[11px] font-medium ${style.textColor} hover:underline`}
                      >
                        {expanded ? "Show less" : `Show all ${filteredTeamworkTasks.length} tasks`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {service.key === "sts" && service.summary?.totalHours !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Hours This Week
                  </p>
                  <span className={`text-sm font-bold ${style.textColor}`}>
                    {projectFilter
                      ? `${filteredStsProjects.reduce((sum, p) => sum + p.hours, 0).toFixed(1)}h`
                      : `${service.summary.totalHours}h`}
                  </span>
                </div>
                <ProjectFilter
                  projects={stsProjects}
                  selected={projectFilter}
                  onChange={setProjectFilter}
                  accentColor={style.textColor}
                />
                {!projectFilter && service.summary.daysSummary && (
                  <div className={`rounded-lg ${style.bgColor} px-3 py-2`}>
                    <p className="text-[11px] text-muted-foreground">
                      {service.summary.daysSummary}
                    </p>
                  </div>
                )}
                {filteredStsProjects.length > 0 && (
                  <div className="space-y-1">
                    {filteredStsProjects.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between py-1 px-2 rounded-lg bg-muted/30"
                      >
                        <span className="text-xs text-foreground truncate flex-1">
                          {p.name}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground ml-2 shrink-0">
                          {p.hours.toFixed(1)}h
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Use{" "}
                  <span className="font-mono font-semibold">@STS</span>{" "}
                  in chat for detailed breakdown
                </p>
              </div>
            )}

            {(service.key === "zoho_people" ||
              service.key === "zoho_crm") &&
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
                        : "ZohoCRM"}
                    </span>{" "}
                    in chat to query data
                  </p>
                </div>
              )}

            {service.key === "sts" && service.summary?.totalHours === undefined && service.summary?.status && (
              <div className={`rounded-lg ${style.bgColor} px-3 py-2`}>
                <p className={`text-xs font-medium ${style.textColor}`}>
                  {service.summary.status}
                </p>
              </div>
            )}

            {service.key === "outlook_email" && service.summary?.emails && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recent Emails
                  </p>
                  <Mail className={`w-3.5 h-3.5 ${style.textColor}`} />
                </div>
                {service.summary.emails.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No recent emails</p>
                ) : (
                  service.summary.emails.map((email, idx) => (
                    <div
                      key={idx}
                      className={`py-1.5 px-2 rounded-lg bg-muted/30 ${!email.isRead ? "border-l-2 border-sky-500" : ""}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {!email.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                        )}
                        <span className={`text-xs truncate flex-1 ${!email.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>
                          {email.subject}
                        </span>
                        {email.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">
                          {email.from}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {email.receivedAt ? formatRelativeTime(email.receivedAt) : ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <p className="text-[11px] text-muted-foreground">
                  Use <span className="font-mono font-semibold">@Outlook</span> in chat for more
                </p>
              </div>
            )}

            {service.key === "outlook_calendar" && service.summary?.events && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Upcoming Events
                  </p>
                  <Calendar className={`w-3.5 h-3.5 ${style.textColor}`} />
                </div>
                {service.summary.events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No upcoming events</p>
                ) : (
                  service.summary.events.map((event, idx) => (
                    <div key={idx} className="py-1.5 px-2 rounded-lg bg-muted/30">
                      <span className="text-xs font-medium text-foreground truncate block">
                        {event.subject}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {event.isAllDay
                            ? formatEventDate(event.startTime)
                            : `${formatEventDateTime(event.startTime)} - ${formatEventTime(event.endTime)}`}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] text-muted-foreground truncate">
                            {event.location}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <p className="text-[11px] text-muted-foreground">
                  Use <span className="font-mono font-semibold">@Outlook</span> in chat for details
                </p>
              </div>
            )}

            {externalUrl !== "#" && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${style.bgColor} ${style.textColor} hover:opacity-80`}
              >
                Open {service.name}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(service.key === "outlook_email" || service.key === "outlook_calendar") ? (
              <div className={`rounded-lg ${style.bgColor} px-3 py-2`}>
                <p className={`text-xs font-medium ${style.textColor}`}>
                  {service.summary?.status || "Microsoft Outlook is not configured on this server."}
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage({
  user,
  token,
  onOpenChat,
  onOpenConnections,
}: DashboardPageProps) {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const defaultServices: ServiceData[] = [
    { key: "outlook_email", name: "Outlook Email", connected: false },
    { key: "outlook_calendar", name: "Outlook Calendar", connected: false },
    { key: "jira", name: "JIRA", connected: false },
    { key: "zoho_people", name: "Zoho People", connected: false },
    { key: "zoho_crm", name: "Zoho CRM", connected: false },
    { key: "sts", name: "STS", connected: false },
    { key: "teamwork", name: "Teamwork", connected: false },
  ];

  async function fetchDashboard() {
    try {
      const res = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setServices(data.services?.length ? data.services : defaultServices);
      } else {
        setServices(defaultServices);
      }
    } catch {
      setServices(defaultServices);
    } finally {
      setLoading(false);
    }
  }

  const connectedCount = services.filter((s) => s.connected).length;

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center px-4 md:px-6 border-b border-border/50 bg-background z-10">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Dashboard</h1>
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
