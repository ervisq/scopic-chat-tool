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
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Eye,
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; currentMonth: boolean; date: string }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, currentMonth: false, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({ day: d, currentMonth: false, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
  }

  return cells;
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
        aria-label="Filter by project"
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

function WeeklyHoursPanel({ service }: { service: ServiceData | undefined }) {
  const totalHours = service?.summary?.totalHours ?? 0;
  const maxHours = 40;
  const percentage = Math.min((totalHours / maxHours) * 100, 100);
  const isConnected = service?.connected ?? false;
  const hasError = !!service?.error;
  const byProject = service?.summary?.byProject || [];
  const stsUrl = EXTERNAL_URLS.sts(service?.instanceUrl);

  let barColor = "bg-emerald-500";
  if (percentage >= 100) barColor = "bg-emerald-600";
  else if (percentage >= 75) barColor = "bg-emerald-500";
  else if (percentage >= 50) barColor = "bg-amber-500";
  else barColor = "bg-emerald-400";

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Weekly Hours</h3>
              {isConnected ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">STS Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">STS Not connected</span>
                </div>
              )}
            </div>
          </div>
          <a
            href={stsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Open STS
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {isConnected && !hasError && service?.summary?.totalHours !== undefined ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</span>
                <span className="text-xs text-muted-foreground">/ {maxHours}h</span>
              </div>
              <div className="w-full h-3 bg-muted/50 rounded-full overflow-hidden" role="progressbar" aria-valuenow={totalHours} aria-valuemin={0} aria-valuemax={maxHours} aria-label="Weekly hours logged">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {service?.summary?.daysSummary && (
                <p className="text-[11px] text-muted-foreground mt-1.5">{service.summary.daysSummary}</p>
              )}
            </div>

            {byProject.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">By Project</p>
                {byProject.map((p) => (
                  <div key={p.name} className="flex items-center justify-between py-1 px-2 rounded-lg bg-muted/30">
                    <span className="text-xs text-foreground truncate flex-1">{p.name}</span>
                    <span className="text-xs font-medium text-muted-foreground ml-2 shrink-0">{p.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isConnected && hasError ? (
          <p className="text-xs text-muted-foreground italic">{service?.error}</p>
        ) : isConnected && service?.summary?.status ? (
          <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{service.summary.status}</p>
          </div>
        ) : !isConnected ? (
          <p className="text-xs text-muted-foreground">Connect STS to track your weekly hours.</p>
        ) : null}
      </div>
    </div>
  );
}

function OutlookPanel({
  calendarService,
  emailService,
}: {
  calendarService: ServiceData | undefined;
  emailService: ServiceData | undefined;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const events = calendarService?.summary?.events || [];
  const emails = emailService?.summary?.emails || [];
  const isCalConnected = calendarService?.connected ?? false;
  const isEmailConnected = emailService?.connected ?? false;
  const isConnected = isCalConnected || isEmailConnected;
  const notConfiguredMsg = !isConnected
    ? (calendarService?.summary?.status || emailService?.summary?.status || "Microsoft Outlook is not configured on this server.")
    : null;

  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    for (const ev of events) {
      if (ev.startTime) {
        const d = new Date(ev.startTime + (ev.startTime.includes("Z") ? "" : "Z"));
        dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
    }
    return dates;
  }, [events]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-card overflow-hidden flex flex-col">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-sm">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Outlook</h3>
              {isConnected ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Not connected</span>
                </div>
              )}
            </div>
          </div>
          {!isCurrentMonth && (
            <button onClick={goToToday} className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              Today
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} aria-label="Previous month" className="p-1 rounded-md hover:bg-muted/50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} aria-label="Next month" className="p-1 rounded-md hover:bg-muted/50 transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0 mb-1">
          {WEEKDAY_LABELS.map((wd) => (
            <div key={wd} className="text-center text-[10px] font-medium text-muted-foreground py-1">{wd}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0">
          {cells.map((cell, idx) => {
            const isToday = cell.date === todayStr;
            const hasEvent = eventDates.has(cell.date);
            return (
              <div
                key={idx}
                className={`relative flex flex-col items-center justify-center py-1.5 text-xs rounded-lg transition-colors
                  ${cell.currentMonth ? "text-foreground" : "text-muted-foreground/40"}
                  ${isToday ? "bg-indigo-500 text-white font-bold" : ""}
                `}
              >
                {cell.day}
                {hasEvent && !isToday && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-500" />}
                {hasEvent && isToday && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />}
              </div>
            );
          })}
        </div>
      </div>

      {notConfiguredMsg && (
        <div className="border-t border-indigo-500/10 px-4 py-3">
          <div className="rounded-lg bg-indigo-500/10 px-3 py-2">
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{notConfiguredMsg}</p>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="border-t border-indigo-500/10 px-4 py-3 flex-1 flex flex-col min-h-0">
          {isCalConnected ? (
            <div className="mb-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Upcoming Events
              </p>
              {calendarService?.error ? (
                <p className="text-xs text-muted-foreground italic">{calendarService.error}</p>
              ) : events.length > 0 ? (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {events.map((event, idx) => (
                    <div key={idx} className="py-1.5 px-2 rounded-lg bg-muted/30">
                      <span className="text-xs font-medium text-foreground truncate block">{event.subject}</span>
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
                          <span className="text-[10px] text-muted-foreground truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No upcoming events</p>
              )}
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground italic">Calendar not connected</p>
            </div>
          )}

          {isEmailConnected ? (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Recent Emails
              </p>
              {emailService?.error ? (
                <p className="text-xs text-muted-foreground italic">{emailService.error}</p>
              ) : emails.length > 0 ? (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {emails.map((email, idx) => (
                    <div
                      key={idx}
                      className={`py-1.5 px-2 rounded-lg bg-muted/30 ${!email.isRead ? "border-l-2 border-sky-500" : ""}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {!email.isRead && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />}
                        <span className={`text-xs truncate flex-1 ${!email.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>
                          {email.subject}
                        </span>
                        {email.hasAttachments && <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">{email.from}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {email.receivedAt ? formatRelativeTime(email.receivedAt) : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recent emails</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground italic">Email not connected</p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground mt-2 shrink-0">
            Use <span className="font-mono font-semibold">@Outlook</span> in chat for details
          </p>
        </div>
      )}
    </div>
  );
}

function CompactServiceCard({
  service,
  onConnect,
  onViewMore,
}: {
  service: ServiceData;
  onConnect: () => void;
  onViewMore: () => void;
}) {
  const style = SERVICE_STYLES[service.key] || SERVICE_STYLES.jira;

  function getSummaryText(): string {
    if (!service.connected) return "";
    if (service.error) return service.error;
    if (service.key === "jira") {
      const open = service.summary?.openTickets;
      const total = service.summary?.totalTickets;
      if (open !== undefined) return `${open} open task${open !== 1 ? "s" : ""}${total ? ` of ${total}` : ""}`;
      return service.summary?.status || "Connected";
    }
    if (service.key === "teamwork") {
      const active = service.summary?.activeTasks;
      const total = service.summary?.totalTasks;
      if (active !== undefined) return `${active} active task${active !== 1 ? "s" : ""}${total ? ` of ${total}` : ""}`;
      return service.summary?.status || "Connected";
    }
    if (service.key === "zoho_people" || service.key === "zoho_crm") {
      return service.summary?.status || "Connected";
    }
    return service.summary?.status || "Connected";
  }

  const summaryText = getSummaryText();
  const hasDetailData = service.connected && !service.error && (
    (service.key === "jira" && (service.summary?.tickets?.length ?? 0) > 0) ||
    (service.key === "teamwork" && (service.summary?.tasks?.length ?? 0) > 0) ||
    (service.key === "zoho_people" && service.summary?.status) ||
    (service.key === "zoho_crm" && service.summary?.status)
  );

  return (
    <div className={`rounded-2xl border ${style.borderColor} bg-card overflow-hidden transition-all hover:shadow-md`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${style.color} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-xs font-bold tracking-wider">{style.icon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-[15px]">{service.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {service.connected ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Not connected</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {service.connected ? (
          <div className="space-y-3">
            {summaryText && (
              <div className={`rounded-lg ${style.bgColor} px-3 py-2`}>
                <p className={`text-xs font-medium ${service.error ? "text-muted-foreground italic" : style.textColor}`}>
                  {summaryText}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {hasDetailData && (
                <button
                  onClick={onViewMore}
                  className={`flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${style.bgColor} ${style.textColor} hover:opacity-80`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View more
                </button>
              )}
              {EXTERNAL_URLS[service.key] && (
                <a
                  href={EXTERNAL_URLS[service.key]!(service.instanceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-1.5 ${hasDetailData ? "px-3" : "flex-1"} py-2 rounded-xl text-xs font-medium transition-colors ${style.bgColor} ${style.textColor} hover:opacity-80`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {!hasDetailData && `Open ${service.name}`}
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Connect your {service.name} account to see your data here and use it in chat.
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

function ServiceDrawer({
  service,
  onClose,
}: {
  service: ServiceData | null;
  onClose: () => void;
}) {
  const [projectFilter, setProjectFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const DISPLAY_LIMIT = 10;

  useEffect(() => {
    setProjectFilter("");
    setExpanded(false);
  }, [service?.key]);

  useEffect(() => {
    if (!service) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [service, onClose]);

  if (!service) return null;

  const style = SERVICE_STYLES[service.key] || SERVICE_STYLES.jira;
  const externalUrl = EXTERNAL_URLS[service.key]?.(service.instanceUrl) || "#";

  const jiraProjects = service.key === "jira" && service.summary?.tickets
    ? [...new Set(service.summary.tickets.map((t) => t.project).filter(Boolean))].sort()
    : [];

  const teamworkProjects = service.key === "teamwork" && service.summary?.tasks
    ? [...new Set(service.summary.tasks.map((t) => t.projectName).filter(Boolean))].sort()
    : [];

  const availableProjects = jiraProjects.length > 0 ? jiraProjects : teamworkProjects;

  const filteredJiraTickets = service.summary?.tickets
    ? (projectFilter ? service.summary.tickets.filter((t) => t.project === projectFilter) : service.summary.tickets)
    : [];

  const filteredTeamworkTasks = service.summary?.tasks
    ? (projectFilter ? service.summary.tasks.filter((t) => t.projectName === projectFilter) : service.summary.tasks)
    : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 transition-opacity" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${service.name} details`}
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-card border-l border-border z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${style.color} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-xs font-bold tracking-wider">{style.icon}</span>
            </div>
            <h2 className="font-semibold text-foreground text-base">{service.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close drawer" className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {service.key === "jira" && service.summary?.tickets && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Tasks</p>
                {service.summary.openTickets !== undefined && (
                  <span className={`text-xs font-semibold ${style.textColor}`}>{service.summary.openTickets} open</span>
                )}
              </div>
              <ProjectFilter projects={jiraProjects} selected={projectFilter} onChange={setProjectFilter} accentColor={style.textColor} />
              {filteredJiraTickets.length === 0 ? (
                <p className="text-xs text-muted-foreground">{projectFilter ? "No tasks in this project" : "No tasks found"}</p>
              ) : (
                <>
                  {(expanded ? filteredJiraTickets : filteredJiraTickets.slice(0, DISPLAY_LIMIT)).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30">
                      <PriorityDot priority={t.priority} />
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{t.id}</span>
                      <span className="text-xs text-foreground truncate flex-1">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                  {filteredJiraTickets.length > DISPLAY_LIMIT && (
                    <button onClick={() => setExpanded(!expanded)} className={`text-[11px] font-medium ${style.textColor} hover:underline`}>
                      {expanded ? "Show less" : `Show all ${filteredJiraTickets.length} tasks`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {service.key === "teamwork" && service.summary?.tasks && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Tasks</p>
                {service.summary.activeTasks !== undefined && (
                  <span className={`text-xs font-semibold ${style.textColor}`}>{service.summary.activeTasks} active</span>
                )}
              </div>
              <ProjectFilter projects={teamworkProjects} selected={projectFilter} onChange={setProjectFilter} accentColor={style.textColor} />
              {filteredTeamworkTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">{projectFilter ? "No tasks in this project" : "No tasks found"}</p>
              ) : (
                <>
                  {(expanded ? filteredTeamworkTasks : filteredTeamworkTasks.slice(0, DISPLAY_LIMIT)).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30">
                      <PriorityDot priority={t.priority} />
                      <span className="text-xs font-mono text-muted-foreground shrink-0">#{t.id}</span>
                      <span className="text-xs text-foreground truncate flex-1">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                  {filteredTeamworkTasks.length > DISPLAY_LIMIT && (
                    <button onClick={() => setExpanded(!expanded)} className={`text-[11px] font-medium ${style.textColor} hover:underline`}>
                      {expanded ? "Show less" : `Show all ${filteredTeamworkTasks.length} tasks`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {(service.key === "zoho_people" || service.key === "zoho_crm") && service.summary?.status && (
            <div className={`rounded-lg ${style.bgColor} px-4 py-3`}>
              <p className={`text-sm font-medium ${style.textColor}`}>{service.summary.status}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use <span className="font-mono font-semibold">@{service.key === "zoho_people" ? "ZohoPeople" : "ZohoCRM"}</span> in chat to query data
              </p>
            </div>
          )}
        </div>

        {externalUrl !== "#" && (
          <div className="shrink-0 p-4 border-t border-border/50">
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
        )}
      </div>
    </>
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
  const [drawerService, setDrawerService] = useState<ServiceData | null>(null);

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

  const stsService = services.find((s) => s.key === "sts");
  const calendarService = services.find((s) => s.key === "outlook_calendar");
  const emailService = services.find((s) => s.key === "outlook_email");
  const rightServices = services.filter(
    (s) => s.key !== "sts" && s.key !== "outlook_calendar" && s.key !== "outlook_email"
  );
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
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
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
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              <div className="w-full md:w-[340px] shrink-0 space-y-4">
                <WeeklyHoursPanel service={stsService} />
                <OutlookPanel calendarService={calendarService} emailService={emailService} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                  {rightServices.map((service) => (
                    <CompactServiceCard
                      key={service.key}
                      service={service}
                      onConnect={onOpenConnections}
                      onViewMore={() => setDrawerService(service)}
                    />
                  ))}
                </div>
              </div>
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

      <ServiceDrawer service={drawerService} onClose={() => setDrawerService(null)} />
    </div>
  );
}
