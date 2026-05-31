import { useState, useEffect, useMemo, useRef, type ComponentType, type SVGProps } from "react";
import {
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
  User,
  FolderOpen,
  CalendarClock,
  BarChart3,
  ChevronDown,
  Settings,
  RefreshCw,
} from "lucide-react";
import { JiraIcon, TeamworkIcon, OutlookIcon, ZohoIcon, StsIcon } from "../components/chat/tool-icons";
import { safeExternalUrl } from "@/lib/utils";
import { useObjectDetail, type DetailTarget } from "@/components/object-detail-provider";
import { useToolVisibility } from "@/lib/tool-visibility";
import { ToolVisibilityPanel } from "@/components/tool-visibility-panel";
import { ConnectServiceDialog } from "@/components/connect-service-dialog";
import { DashboardTileMenu } from "@/components/dashboard-tile-menu";
import { toast } from "@/hooks/use-toast";
import {
  detectReconnectProvider,
  getProviderConfig,
  startOAuthConnect,
  type ProviderConfig,
} from "@/lib/connect-service";

const SERVICE_KEY_TO_TOOL_NAME: Record<string, string> = {
  jira: "JIRA",
  zoho_people: "ZohoPeople",
  zoho_crm: "ZohoCRM",
  zoho_recruit: "ZohoRecruit",
  zoho_contracts: "ZohoContracts",
  sts: "STS",
  teamwork: "Teamwork",
  outlook_email: "Outlook",
  outlook_calendar: "Outlook",
};

const ZOHO_SUB_KEYS = ["zoho_people", "zoho_crm", "zoho_recruit", "zoho_contracts"] as const;
const ZOHO_SUB_TOOL_NAMES = ["ZohoPeople", "ZohoCRM", "ZohoRecruit", "ZohoContracts"] as const;

interface DashboardPageProps {
  user: { email: string; name: string } | null;
  token: string | null;
  onOpenConnections: () => void;
}

interface JiraTicketSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  project: string;
  assignee?: string;
}

interface StsProjectSummary {
  name: string;
  hours: number;
}

interface OutlookEmailSummary {
  id?: string;
  subject: string;
  from: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  preview?: string;
}

interface OutlookEventLocation {
  displayName: string;
  locationType?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    countryOrRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
}

interface OutlookEventSummary {
  id?: string;
  subject: string;
  startTime: string;
  endTime: string;
  location: OutlookEventLocation;
  isAllDay: boolean;
  organizer?: string;
}

interface RecruitCandidateSummary {
  id: string;
  name: string;
  email: string;
  status: string;
  currentJobTitle: string;
  currentEmployer: string;
}

interface RecruitJobOpeningSummary {
  id: string;
  title: string;
  department: string;
  status: string;
  positions: string;
}

interface ContractSummary {
  id: string;
  contractName: string;
  contractType: string;
  contractStatus: string;
  company: string;
  startDate: string;
  endDate: string;
  contractValue: string;
}

interface PeopleLeaveSummary {
  employee: string;
  leaveType: string;
  from: string;
  to: string;
  dayCount: string;
}

interface PeopleJoinerSummary {
  id: string;
  name: string;
  designation: string;
  department: string;
  dateOfJoining: string;
}

interface CrmDealSummary {
  id: string;
  name: string;
  stage: string;
  amount: string;
  closingDate: string;
  account: string;
}

interface CrmLeadSummary {
  id: string;
  name: string;
  company: string;
  leadStatus: string;
  email: string;
}

interface CrmTaskSummary {
  id: string;
  subject: string;
  status: string;
  priority: string;
  relatedTo: string;
}

interface InterviewSummary {
  id: string;
  interviewName: string;
  candidateName: string;
  interviewDate: string;
  from: string;
  to: string;
  jobOpeningName: string;
  status: string;
}

interface TeamworkTaskSummary {
  id: number;
  title: string;
  status: string;
  priority: string;
  projectName: string;
  assignee?: string;
  dueDate?: string;
  taskListName?: string;
  progress?: number;
}

interface ServiceData {
  key: string;
  name: string;
  connected: boolean;
  accessible?: boolean;
  suite?: boolean;
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
    candidates?: RecruitCandidateSummary[];
    jobOpenings?: RecruitJobOpeningSummary[];
    openPositions?: number;
    candidateCount?: number;
    contracts?: ContractSummary[];
    expiringContracts?: ContractSummary[];
    activeCount?: number;
    expiringCount?: number;
    totalContracts?: number;
    onLeaveToday?: PeopleLeaveSummary[];
    recentJoiners?: PeopleJoinerSummary[];
    onLeaveTodayCount?: number;
    recentJoinersCount?: number;
    employeeCount?: number;
    openDeals?: CrmDealSummary[];
    recentLeads?: CrmLeadSummary[];
    tasksDueToday?: CrmTaskSummary[];
    openPipelineFormatted?: string;
    openDealsCount?: number;
    closingThisMonthCount?: number;
    recentLeadsCount?: number;
    tasksDueTodayCount?: number;
    leadCount?: number;
    upcomingInterviews?: InterviewSummary[];
    upcomingInterviewsCount?: number;
    dueTodayCount?: number;
    overdueCount?: number;
    unreadCount?: number;
    todayCount?: number;
    nextEventInMinutes?: number;
    lastWeekHours?: number;
  };
  error?: string;
  subServices?: ServiceData[];
}

function CountBadge({ label, value, tone }: { label: string; value: number; tone: "amber" | "rose" | "sky" }) {
  if (!value) return null;
  const toneClass =
    tone === "rose"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      : tone === "amber"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${toneClass}`}>
      {value} {label}
    </span>
  );
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const SERVICE_STYLES: Record<
  string,
  { color: string; bgColor: string; textColor: string; borderColor: string; Icon: IconComponent }
> = {
  jira: {
    color: "bg-blue-500",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/20",
    Icon: JiraIcon,
  },
  zoho_people: {
    color: "bg-amber-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/20",
    Icon: ZohoIcon,
  },
  zoho_crm: {
    color: "bg-orange-500",
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/20",
    Icon: ZohoIcon,
  },
  zoho_recruit: {
    color: "bg-rose-500",
    bgColor: "bg-rose-500/10",
    textColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-500/20",
    Icon: ZohoIcon,
  },
  zoho_contracts: {
    color: "bg-teal-500",
    bgColor: "bg-teal-500/10",
    textColor: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-500/20",
    Icon: ZohoIcon,
  },
  zoho: {
    color: "bg-amber-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/20",
    Icon: ZohoIcon,
  },
  sts: {
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/20",
    Icon: StsIcon,
  },
  teamwork: {
    color: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/20",
    Icon: TeamworkIcon,
  },
  outlook_email: {
    color: "bg-sky-500",
    bgColor: "bg-sky-500/10",
    textColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-500/20",
    Icon: OutlookIcon,
  },
  outlook_calendar: {
    color: "bg-indigo-500",
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-indigo-500/20",
    Icon: OutlookIcon,
  },
};

const EXTERNAL_URLS: Record<string, (instanceUrl?: string | null) => string> = {
  jira: () => "https://scopicsoftware.atlassian.net",
  zoho_people: () => "https://people.zoho.com",
  zoho_crm: () => "https://crm.zoho.com",
  zoho_recruit: () => "https://recruit.zoho.com",
  zoho_contracts: () => "https://contracts.zoho.com",
  zoho: () => "https://www.zoho.com",
  sts: (instanceUrl) => instanceUrl || "https://time.scopicsoftware.com",
  teamwork: (instanceUrl) => instanceUrl || "https://www.teamwork.com",
  outlook_email: () => "https://outlook.office.com/mail",
  outlook_calendar: () => "https://outlook.office.com/calendar",
  outlook: () => "https://outlook.office.com",
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "To Do": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  };
  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colors[status] || "bg-muted text-muted-foreground"}`}
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
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colors[priority] || "bg-muted-foreground"}`}
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

function formatDueDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}


function ExpandableTeamworkRow({
  task,
  tasks,
  instanceUrl,
}: {
  task: TeamworkTaskSummary;
  tasks: TeamworkTaskSummary[];
  instanceUrl?: string | null;
}) {
  const { openDetailList } = useObjectDetail();
  const twBase = instanceUrl ? safeExternalUrl(instanceUrl) : "";

  const targets = useMemo<DetailTarget[]>(
    () =>
      tasks.map((t) => ({
        type: "teamwork_task" as const,
        id: t.id,
        openUrl: twBase ? `${twBase}/app/tasks/${t.id}` : null,
        label: t.title,
      })),
    [tasks, twBase],
  );

  const index = tasks.findIndex((t) => t.id === task.id);

  return (
    <button
      type="button"
      onClick={() => openDetailList(targets, index < 0 ? 0 : index)}
      className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30 text-left border-none cursor-pointer transition-colors hover:bg-muted/60"
    >
      <PriorityDot priority={task.priority} />
      <span className="text-xs font-mono text-muted-foreground shrink-0">#{task.id}</span>
      <span className="text-xs text-foreground truncate flex-1">{task.title}</span>
      <StatusBadge status={task.status} />
    </button>
  );
}

function ExpandableEmailRow({
  email,
  emails,
}: {
  email: OutlookEmailSummary;
  emails: OutlookEmailSummary[];
}) {
  const { openDetailList } = useObjectDetail();

  const targets = useMemo<DetailTarget[]>(
    () =>
      emails
        .filter((e) => e.id)
        .map((e) => ({
          type: "outlook_email" as const,
          id: e.id!,
          openUrl: `https://outlook.office.com/mail/inbox/id/${encodeURIComponent(e.id!)}`,
          label: e.subject,
          unread: !e.isRead,
        })),
    [emails],
  );

  const rowContent = (
    <>
      <div className="flex items-center gap-2">
        {!email.isRead && <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />}
        <span
          className={`text-sm truncate flex-1 ${
            !email.isRead ? "font-semibold text-foreground" : "text-foreground"
          }`}
        >
          {email.subject}
        </span>
        {email.hasAttachments && (
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground truncate">{email.from}</span>
        <span className="text-xs text-muted-foreground shrink-0 ml-2">
          {email.receivedAt ? formatRelativeTime(email.receivedAt) : ""}
        </span>
      </div>
    </>
  );

  const baseClass = `w-full block py-2 px-3 rounded-lg bg-muted/30 ${
    !email.isRead ? "border-l-2 border-sky-500" : ""
  }`;

  if (!email.id) {
    return <div className={baseClass}>{rowContent}</div>;
  }

  const index = targets.findIndex((t) => t.id === email.id);

  return (
    <button
      type="button"
      onClick={() => openDetailList(targets, index < 0 ? 0 : index)}
      className={`${baseClass} text-left border-none cursor-pointer transition-colors hover:bg-muted/60`}
    >
      {rowContent}
    </button>
  );
}

function WeeklyHoursPanel({
  service,
  onConnect,
  connecting = false,
  connectingLabel = "Connecting…",
  tileError = null,
  onDisconnect,
  onUpdate,
  onHide,
}: {
  service: ServiceData | undefined;
  onConnect: () => void;
  connecting?: boolean;
  connectingLabel?: string;
  tileError?: string | null;
  onDisconnect: () => void;
  onUpdate?: () => void;
  onHide: () => void;
}) {
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
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-sm border border-border/50">
              <StsIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground text-sm">STS</h3>
                <a
                  href={stsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open STS"
                  aria-label="Open STS"
                  className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Not connected</span>
                </div>
              )}
            </div>
          </div>
          <DashboardTileMenu
            connected={isConnected}
            onDisconnect={onDisconnect}
            onUpdate={onUpdate}
            onHide={onHide}
            testId="tile-menu-sts"
          />
        </div>

        {isConnected && !hasError && service?.summary?.totalHours !== undefined ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-3xl font-bold text-foreground">{totalHours.toFixed(1)}h</span>
                <span className="text-sm text-muted-foreground">/ {maxHours}h</span>
              </div>
              <div className="w-full h-3.5 bg-muted/50 rounded-full overflow-hidden" role="progressbar" aria-valuenow={totalHours} aria-valuemin={0} aria-valuemax={maxHours} aria-label="Weekly hours logged">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {service?.summary?.daysSummary && (
                <p className="text-xs text-muted-foreground mt-2">{service.summary.daysSummary}</p>
              )}
              {service?.summary?.lastWeekHours !== undefined && (() => {
                const last = service.summary!.lastWeekHours!;
                const diff = totalHours - last;
                const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "•";
                const tone = diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
                return (
                  <p className={`text-xs mt-1 ${tone}`}>
                    {arrow} {Math.abs(diff).toFixed(1)}h vs last week ({last.toFixed(1)}h)
                  </p>
                );
              })()}
            </div>

            {byProject.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">By Project</p>
                {byProject.map((p) => (
                  <div key={p.name} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-muted/30">
                    <span className="text-xs text-foreground truncate flex-1">{p.name}</span>
                    <span className="text-xs font-semibold text-muted-foreground ml-2 shrink-0">{p.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isConnected && hasError ? (
          <p className="text-sm text-muted-foreground italic">{service?.error}</p>
        ) : isConnected && service?.summary?.status ? (
          <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{service.summary.status}</p>
          </div>
        ) : !isConnected ? (
          <p className="text-sm text-muted-foreground">Connect STS to track your weekly hours.</p>
        ) : null}

        {!isConnected && (
          <>
            <button
              onClick={onConnect}
              disabled={connecting}
              className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 text-white hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {connecting ? connectingLabel : "Connect STS"}
            </button>
            {tileError && (
              <p className="mt-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-1.5" role="alert">
                {tileError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OutlookPanel({
  calendarService,
  emailService,
  onConnect,
  onHide,
}: {
  calendarService: ServiceData | undefined;
  emailService: ServiceData | undefined;
  onConnect: () => void;
  onHide: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"emails" | "events">("emails");

  const events = calendarService?.summary?.events || [];
  const emails = emailService?.summary?.emails || [];
  const isCalConnected = calendarService?.connected ?? false;
  const isEmailConnected = emailService?.connected ?? false;
  const unreadCount = emailService?.summary?.unreadCount ?? 0;
  const todayCount = calendarService?.summary?.todayCount ?? 0;
  const nextEventInMinutes = calendarService?.summary?.nextEventInMinutes;
  const formatNext = (mins: number) => {
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  };
  const isConnected = isCalConnected || isEmailConnected;
  const notConfiguredMsg = !isConnected
    ? (calendarService?.summary?.status || emailService?.summary?.status || "Microsoft Outlook is not configured on this server.")
    : null;

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-card overflow-hidden flex flex-col">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-sm border border-border/50">
              <OutlookIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground text-sm">Outlook</h3>
                <a
                  href={EXTERNAL_URLS.outlook()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open Outlook"
                  aria-label="Open Outlook"
                  className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Not connected</span>
                </div>
              )}
            </div>
          </div>
          <DashboardTileMenu
            connected={isConnected}
            canDisconnect={false}
            disconnectDisabledReason="Managed by your administrator"
            onDisconnect={() => {}}
            onHide={onHide}
            testId="tile-menu-outlook"
          />
        </div>

        {notConfiguredMsg && (
          <div className="rounded-lg bg-indigo-500/10 px-3 py-2 mb-3">
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{notConfiguredMsg}</p>
          </div>
        )}

        {isConnected && (
          <>
            <div className="flex rounded-xl bg-muted/50 p-1 mb-4">
              <button
                onClick={() => setActiveTab("emails")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "emails"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Recent Emails
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-semibold leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "events"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Recent Events
                {todayCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-semibold leading-none">
                    {todayCount}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "emails" && (
              <div>
                {!isEmailConnected ? (
                  <p className="text-sm text-muted-foreground italic">Email not connected</p>
                ) : emailService?.error ? (
                  <p className="text-sm text-muted-foreground italic">{emailService.error}</p>
                ) : emails.length > 0 ? (
                  <div className="space-y-2 max-h-[330px] overflow-y-auto">
                    {emails.map((email, idx) => (
                      <ExpandableEmailRow key={idx} email={email} emails={emails} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent emails</p>
                )}
              </div>
            )}

            {activeTab === "events" && (
              <div>
                {isCalConnected && !calendarService?.error && nextEventInMinutes !== undefined && (
                  <div className="mb-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    Next event {formatNext(nextEventInMinutes)}
                  </div>
                )}
                {!isCalConnected ? (
                  <p className="text-sm text-muted-foreground italic">Calendar not connected</p>
                ) : calendarService?.error ? (
                  <p className="text-sm text-muted-foreground italic">{calendarService.error}</p>
                ) : events.length > 0 ? (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {events.map((event, idx) => (
                      <div key={idx} className="py-2 px-3 rounded-lg bg-muted/30">
                        {event.id ? (
                          <a
                            href={`https://outlook.office.com/calendar/item/${encodeURIComponent(event.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-foreground truncate block hover:underline hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {event.subject}
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-foreground truncate block">{event.subject}</span>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">
                            {event.isAllDay
                              ? formatEventDate(event.startTime)
                              : `${formatEventDateTime(event.startTime)} – ${formatEventTime(event.endTime)}`}
                          </span>
                        </div>
                        {event.location?.displayName && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{event.location.displayName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming events</p>
                )}
              </div>
            )}
          </>
        )}

        {!isConnected && (
          <button
            onClick={onConnect}
            className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-indigo-500 text-white hover:opacity-90"
          >
            <Link2 className="w-4 h-4" />
            Connect Outlook
          </button>
        )}
      </div>
    </div>
  );
}

function ZohoSubSummary({
  sub,
}: {
  sub: ServiceData;
}) {
  const style = SERVICE_STYLES[sub.key] || SERVICE_STYLES.zoho;

  function getSubSummaryText(): string {
    if (sub.error) return sub.error;
    if (sub.key === "zoho_people" || sub.key === "zoho_crm") {
      return sub.summary?.status || "Connected";
    }
    if (sub.key === "zoho_recruit") {
      const open = sub.summary?.openPositions;
      const cands = sub.summary?.candidateCount;
      if (open !== undefined && cands !== undefined) {
        return `${open} open position${open !== 1 ? "s" : ""}, ${cands} candidate${cands !== 1 ? "s" : ""}`;
      }
      return sub.summary?.status || "Connected";
    }
    if (sub.key === "zoho_contracts") {
      const active = sub.summary?.activeCount;
      const expiring = sub.summary?.expiringCount;
      if (active !== undefined) {
        return `${active} active${expiring ? `, ${expiring} expiring soon` : ""}`;
      }
      return sub.summary?.status || "Connected";
    }
    return sub.summary?.status || "Connected";
  }

  const summaryText = getSubSummaryText();

  const externalUrl = EXTERNAL_URLS[sub.key]?.(sub.instanceUrl);

  return (
    <div className={`rounded-xl border ${style.borderColor} bg-card overflow-hidden transition-all hover:shadow-sm`}>
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-card flex items-center justify-center shadow-sm border border-border/50 shrink-0">
              <style.Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="font-semibold text-foreground text-sm truncate">{sub.name}</h4>
                {externalUrl && (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`Open ${sub.name}`}
                    aria-label={`Open ${sub.name}`}
                    className="inline-flex items-center justify-center p-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {sub.error ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Limited access</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Connected</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {summaryText && (
          <div className={`rounded-lg ${style.bgColor} px-3 py-2 mb-2`}>
            <p className={`text-xs font-medium ${sub.error ? "text-muted-foreground italic" : style.textColor}`}>
              {summaryText}
            </p>
          </div>
        )}

        {sub.key === "zoho_recruit" && !sub.error && (sub.summary?.upcomingInterviewsCount ?? 0) > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <CountBadge label="interviews this week" value={sub.summary?.upcomingInterviewsCount ?? 0} tone="rose" />
          </div>
        )}
        {sub.key === "zoho_contracts" && !sub.error && (sub.summary?.expiringCount ?? 0) > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <CountBadge label="expiring in 30d" value={sub.summary?.expiringCount ?? 0} tone="amber" />
          </div>
        )}

        {sub.key === "zoho_people" && !sub.error && (
          ((sub.summary?.onLeaveToday?.length ?? 0) > 0 || (sub.summary?.recentJoiners?.length ?? 0) > 0) && (
            <div className="mb-2 space-y-1 max-h-[120px] overflow-y-auto">
              {(sub.summary?.onLeaveToday ?? []).slice(0, 20).map((l, i) => (
                <p key={`leave-${i}`} className="text-[11px] text-muted-foreground truncate">
                  <span className="text-muted-foreground/80">On leave:</span> {l.employee || "—"}
                  {l.leaveType ? ` · ${l.leaveType}` : ""}
                </p>
              ))}
              {(sub.summary?.recentJoiners ?? [])
                .slice(0, 20)
                .map((j) => (
                  <p key={`joiner-${j.id}`} className="text-[11px] text-muted-foreground truncate">
                    <span className="text-muted-foreground/80">Joined:</span> {j.name || "—"}
                    {j.designation ? ` · ${j.designation}` : ""}
                  </p>
                ))}
            </div>
          )
        )}
        {sub.key === "zoho_crm" && !sub.error && (
          ((sub.summary?.openDeals?.length ?? 0) > 0 || (sub.summary?.tasksDueToday?.length ?? 0) > 0) && (
            <div className="mb-2 space-y-1 max-h-[120px] overflow-y-auto">
              {(sub.summary?.openDeals ?? []).slice(0, 20).map((d) => (
                <div key={`deal-${d.id}`} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{d.name || "Deal"}</span>
                  {d.amount && (
                    <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{d.amount}</span>
                  )}
                </div>
              ))}
              {(sub.summary?.tasksDueToday ?? [])
                .slice(0, 20)
                .map((t) => (
                  <p key={`task-${t.id}`} className="text-[11px] text-muted-foreground truncate">
                    <span className="text-muted-foreground/80">Due today:</span> {t.subject || "Task"}
                  </p>
                ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  onConnect,
  connecting = false,
  connectingLabel = "Connecting…",
  tileError = null,
  onDisconnect,
  onUpdate,
  onHide,
}: {
  service: ServiceData;
  onConnect: () => void;
  connecting?: boolean;
  connectingLabel?: string;
  tileError?: string | null;
  onDisconnect: () => void;
  onUpdate?: () => void;
  onHide: () => void;
}) {
  const isZohoSuite =
    service.key === "zoho" &&
    service.connected &&
    !service.error &&
    (service.subServices?.length ?? 0) > 0;
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
    if (service.key === "zoho_recruit") {
      const open = service.summary?.openPositions;
      const cands = service.summary?.candidateCount;
      if (open !== undefined && cands !== undefined) {
        return `${open} open position${open !== 1 ? "s" : ""}, ${cands} candidate${cands !== 1 ? "s" : ""}`;
      }
      return service.summary?.status || "Connected";
    }
    if (service.key === "zoho_contracts") {
      const active = service.summary?.activeCount;
      const expiring = service.summary?.expiringCount;
      if (active !== undefined) {
        return `${active} active${expiring ? `, ${expiring} expiring soon` : ""}`;
      }
      return service.summary?.status || "Connected";
    }
    return service.summary?.status || "Connected";
  }

  const summaryText = getSummaryText();
  const reconnectProvider = service.connected && service.error
    ? detectReconnectProvider(service.error, SERVICE_KEY_TO_TOOL_NAME[service.key])
    : null;
  const PREVIEW_LIMIT = 20;
  const previewTickets = service.key === "jira" ? (service.summary?.tickets || []).slice(0, PREVIEW_LIMIT) : [];
  const previewTasks = service.key === "teamwork" ? (service.summary?.tasks || []).slice(0, PREVIEW_LIMIT) : [];

  return (
    <div className={`rounded-2xl border ${style.borderColor} bg-card overflow-hidden transition-all hover:shadow-md h-full flex flex-col`}>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-card flex items-center justify-center shadow-sm border border-border/50">
              <style.Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground text-base">{service.name}</h3>
                {EXTERNAL_URLS[service.key] && (
                  <a
                    href={EXTERNAL_URLS[service.key]!(service.instanceUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`Open ${service.name}`}
                    aria-label={`Open ${service.name}`}
                    className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {service.connected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Not connected</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <DashboardTileMenu
            connected={service.connected}
            onDisconnect={onDisconnect}
            onUpdate={onUpdate}
            onHide={onHide}
            testId={`tile-menu-${service.key}`}
          />
        </div>

        {service.connected && isZohoSuite ? (
          <div className={`rounded-xl ${style.bgColor} p-3 grid grid-cols-1 md:grid-cols-2 gap-3`}>
            {service.subServices!.map((sub) => (
              <ZohoSubSummary key={sub.key} sub={sub} />
            ))}
          </div>
        ) : service.connected ? (
          <div className="space-y-3">
            {summaryText && (
              <div className={`rounded-lg ${style.bgColor} px-4 py-2.5`}>
                <p className={`text-sm font-medium ${service.error ? "text-muted-foreground italic" : style.textColor}`}>
                  {summaryText}
                </p>
              </div>
            )}

            {reconnectProvider && (
              <button
                onClick={onConnect}
                disabled={connecting}
                data-testid={`tile-reconnect-${service.key}`}
                className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-colors ${style.color} text-white hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {connecting ? connectingLabel : `Reconnect ${service.name}`}
              </button>
            )}

            {service.key === "teamwork" && !service.error && ((service.summary?.overdueCount ?? 0) > 0 || (service.summary?.dueTodayCount ?? 0) > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <CountBadge label="overdue" value={service.summary?.overdueCount ?? 0} tone="rose" />
                <CountBadge label="due today" value={service.summary?.dueTodayCount ?? 0} tone="amber" />
              </div>
            )}

            {service.key === "zoho_recruit" && !service.error && (service.summary?.upcomingInterviewsCount ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <CountBadge label="interviews this week" value={service.summary?.upcomingInterviewsCount ?? 0} tone="rose" />
              </div>
            )}

            {service.key === "zoho_contracts" && !service.error && (service.summary?.expiringCount ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <CountBadge label="expiring in 30d" value={service.summary?.expiringCount ?? 0} tone="amber" />
              </div>
            )}

            {service.key === "zoho_people" && !service.error && (
              <div className="space-y-1.5">
                {(service.summary?.onLeaveToday ?? []).slice(0, 3).map((l, i) => (
                  <div key={`leave-${i}`} className="py-1.5 px-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-foreground truncate">
                      <span className="text-muted-foreground">On leave:</span> {l.employee || "—"}
                      {l.leaveType ? ` · ${l.leaveType}` : ""}
                    </p>
                  </div>
                ))}
                {(service.summary?.recentJoiners ?? []).slice(0, 3 - Math.min((service.summary?.onLeaveToday?.length ?? 0), 3)).map((j) => (
                  <div key={`joiner-${j.id}`} className="py-1.5 px-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-foreground truncate">
                      <span className="text-muted-foreground">Joined:</span> {j.name || "—"}
                      {j.designation ? ` · ${j.designation}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {service.key === "zoho_crm" && !service.error && (
              <div className="space-y-1.5">
                {(service.summary?.openDeals ?? []).slice(0, 3).map((d) => (
                  <div key={`deal-${d.id}`} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg bg-muted/30">
                    <span className="text-xs text-foreground truncate flex-1">{d.name || "Deal"}</span>
                    {d.amount && <span className="text-xs font-semibold text-muted-foreground shrink-0">{d.amount}</span>}
                  </div>
                ))}
                {(service.summary?.tasksDueToday ?? []).slice(0, 3 - Math.min((service.summary?.openDeals?.length ?? 0), 3)).map((t) => (
                  <div key={`task-${t.id}`} className="py-1.5 px-3 rounded-lg bg-amber-100/40 dark:bg-amber-900/20">
                    <p className="text-xs text-foreground truncate">
                      <span className="text-muted-foreground">Due today:</span> {t.subject || "Task"}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {previewTickets.length > 0 && (
              <div className="space-y-1.5 max-h-[232px] overflow-y-auto">
                {previewTickets.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/30">
                    <PriorityDot priority={t.priority} />
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{t.id}</span>
                    {service.instanceUrl ? (
                      <a
                        href={`${service.instanceUrl}/browse/${t.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground truncate flex-1 hover:underline hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {t.title}
                      </a>
                    ) : (
                      <span className="text-sm text-foreground truncate flex-1">{t.title}</span>
                    )}
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            )}

            {previewTasks.length > 0 && (
              <div className="space-y-1.5 max-h-[232px] overflow-y-auto">
                {previewTasks.map((t) => (
                  <ExpandableTeamworkRow
                    key={t.id}
                    task={t}
                    tasks={previewTasks}
                    instanceUrl={service.instanceUrl}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <p className="text-sm text-muted-foreground">
              Connect your {service.name} account to see your data here and use it in chat.
            </p>
            <div className="mt-auto pt-3 space-y-3">
              <button
                onClick={onConnect}
                disabled={connecting}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${style.color} text-white hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {connecting ? connectingLabel : `Connect ${service.name}`}
              </button>
              {tileError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-1.5" role="alert">
                  {tileError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SERVICE_KEY_TO_PROVIDER_KEY: Record<string, string> = {
  jira: "jira",
  zoho: "zoho",
  zoho_people: "zoho",
  zoho_crm: "zoho",
  zoho_recruit: "zoho",
  zoho_contracts: "zoho",
  sts: "sts",
  teamwork: "teamwork",
};

export default function DashboardPage({
  user,
  token,
  onOpenConnections,
}: DashboardPageProps) {
  const dashboardCacheKey = `dashboardCache:${user?.email || "anon"}`;
  const [services, setServices] = useState<ServiceData[]>(() => {
    try {
      const raw = localStorage.getItem(dashboardCacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { services?: ServiceData[] };
        if (Array.isArray(parsed.services) && parsed.services.length > 0) return parsed.services;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    try {
      const raw = localStorage.getItem(dashboardCacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { services?: ServiceData[] };
        if (Array.isArray(parsed.services) && parsed.services.length > 0) return false;
      }
    } catch {
      // ignore
    }
    return true;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [toolSettingsOpen, setToolSettingsOpen] = useState(false);
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const [connectDialogProvider, setConnectDialogProvider] = useState<ProviderConfig | null>(null);
  const [connectDialogMode, setConnectDialogMode] = useState<"connect" | "update">("connect");
  const [connectMessage, setConnectMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tileConnectingKey, setTileConnectingKey] = useState<string | null>(null);
  const [tileErrors, setTileErrors] = useState<Record<string, string>>({});
  const [dialogSaving, setDialogSaving] = useState(false);
  const { isHidden, setHidden, refreshConnectedTools, refreshAccessibleTools } = useToolVisibility();

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    if (!toolSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolMenuRef.current && !toolMenuRef.current.contains(e.target as Node)) {
        setToolSettingsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolSettingsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [toolSettingsOpen]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (!connectMessage) return;
    const t = setTimeout(() => setConnectMessage(null), 6000);
    return () => clearTimeout(t);
  }, [connectMessage]);

  async function handleTileConnect(serviceKey: string) {
    setTileErrors((prev) => {
      if (!(serviceKey in prev)) return prev;
      const { [serviceKey]: _removed, ...rest } = prev;
      return rest;
    });
    const providerKey = SERVICE_KEY_TO_PROVIDER_KEY[serviceKey];
    if (!providerKey) {
      onOpenConnections();
      return;
    }
    const provider = getProviderConfig(providerKey);
    if (!provider) {
      onOpenConnections();
      return;
    }
    if (provider.oauth) {
      setConnectMessage(null);
      setTileConnectingKey(serviceKey);
      const result = await startOAuthConnect(provider.key, token, "dashboard");
      if (!result.ok) {
        setTileConnectingKey(null);
        setTileErrors((prev) => ({ ...prev, [serviceKey]: result.message }));
        setConnectMessage({ type: "error", text: result.message });
      }
      return;
    }
    setConnectDialogMode("connect");
    setConnectDialogProvider(provider);
  }

  async function handleTileUpdate(serviceKey: string) {
    const providerKey = SERVICE_KEY_TO_PROVIDER_KEY[serviceKey];
    if (!providerKey) return;
    const provider = getProviderConfig(providerKey);
    if (!provider) return;
    if (provider.oauth) {
      await handleTileConnect(serviceKey);
      return;
    }
    setTileErrors((prev) => {
      if (!(serviceKey in prev)) return prev;
      const { [serviceKey]: _removed, ...rest } = prev;
      return rest;
    });
    setConnectDialogMode("update");
    setConnectDialogProvider(provider);
  }

  async function handleDisconnectTile(serviceKey: string) {
    const providerKey = SERVICE_KEY_TO_PROVIDER_KEY[serviceKey];
    if (!providerKey) return;
    const service = services.find((s) => s.key === serviceKey);
    const displayName = service?.name ?? providerKey;
    if (providerKey === "zoho") {
      const ok = window.confirm(
        "Disconnecting Zoho will disconnect Zoho People, CRM, Recruit and Contracts. Continue?",
      );
      if (!ok) return;
    }
    setTileErrors((prev) => {
      if (!(serviceKey in prev)) return prev;
      const { [serviceKey]: _removed, ...rest } = prev;
      return rest;
    });
    try {
      const res = await fetch(`${baseUrl}/api/credentials/${providerKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      setConnectMessage({ type: "success", text: `${displayName} disconnected` });
      await fetchDashboard({ fresh: true });
      refreshConnectedTools();
    } catch {
      const msg = `Failed to disconnect ${displayName}`;
      setTileErrors((prev) => ({ ...prev, [serviceKey]: msg }));
      toast({ variant: "destructive", title: "Disconnect failed", description: msg });
    }
  }

  async function handleHideTile(serviceKey: string) {
    const toolNames: string[] =
      serviceKey === "zoho"
        ? [...ZOHO_SUB_TOOL_NAMES]
        : SERVICE_KEY_TO_TOOL_NAME[serviceKey]
          ? [SERVICE_KEY_TO_TOOL_NAME[serviceKey]]
          : [];
    if (toolNames.length === 0) return;
    const service = services.find((s) => s.key === serviceKey);
    const displayLabel =
      service?.name ??
      (serviceKey === "zoho"
        ? "Zoho"
        : serviceKey.startsWith("outlook")
          ? "Outlook"
          : toolNames[0]);
    try {
      await Promise.all(toolNames.map((t) => setHidden(t, true)));
      toast({
        title: `${displayLabel} hidden`,
        description: "Manage in Settings → Tool visibility.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Could not hide tool",
        description: "Please try again.",
      });
    }
  }

  function handleDialogConnected() {
    const name = connectDialogProvider?.name ?? "Service";
    setConnectMessage({
      type: "success",
      text:
        connectDialogMode === "update"
          ? `${name} connection updated successfully`
          : `${name} connected successfully`,
    });
    refreshConnectedTools();
    fetchDashboard({ fresh: true });
  }

  function isTileConnecting(serviceKey: string): boolean {
    if (tileConnectingKey === serviceKey) return true;
    if (
      dialogSaving &&
      connectDialogProvider &&
      SERVICE_KEY_TO_PROVIDER_KEY[serviceKey] === connectDialogProvider.key
    ) {
      return true;
    }
    return false;
  }

  function tileConnectingLabel(serviceKey: string): string {
    if (
      dialogSaving &&
      connectDialogProvider &&
      SERVICE_KEY_TO_PROVIDER_KEY[serviceKey] === connectDialogProvider.key
    ) {
      return "Saving…";
    }
    return "Connecting…";
  }

  const defaultServices: ServiceData[] = [
    { key: "outlook_email", name: "Outlook Email", connected: false },
    { key: "outlook_calendar", name: "Outlook Calendar", connected: false },
    { key: "jira", name: "JIRA", connected: false },
    { key: "zoho", name: "Zoho", connected: false, suite: true },
    { key: "zoho_people", name: "Zoho People", connected: false, accessible: true },
    { key: "zoho_crm", name: "Zoho CRM", connected: false, accessible: true },
    { key: "zoho_recruit", name: "Zoho Recruit", connected: false, accessible: true },
    { key: "zoho_contracts", name: "Zoho Contracts", connected: false, accessible: true },
    { key: "sts", name: "STS", connected: false },
    { key: "teamwork", name: "Teamwork", connected: false },
  ];

  async function autoHideInaccessibleZoho(fetched: ServiceData[]) {
    const userKey = user?.email || "anon";
    for (const s of fetched) {
      if (!ZOHO_SUB_KEYS.includes(s.key as typeof ZOHO_SUB_KEYS[number])) continue;
      const toolName = SERVICE_KEY_TO_TOOL_NAME[s.key];
      if (!toolName) continue;
      const flagKey = `zohoAutoHidden:${userKey}:${toolName}`;
      try {
        if (s.accessible === false) {
          if (!localStorage.getItem(flagKey)) {
            if (!isHidden(toolName)) {
              await setHidden(toolName, true);
            }
            localStorage.setItem(flagKey, "1");
          }
        } else if (s.accessible === true) {
          localStorage.removeItem(flagKey);
        }
      } catch {
        // best-effort; ignore
      }
    }
  }

  async function fetchDashboard(opts: { fresh?: boolean } = {}) {
    setRefreshing(true);
    try {
      const url = `${baseUrl}/api/dashboard${opts.fresh ? "?fresh=1" : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const fetched: ServiceData[] = data.services?.length ? data.services : defaultServices;
        setServices(fetched);
        try {
          localStorage.setItem(dashboardCacheKey, JSON.stringify({ services: fetched }));
        } catch {
          // ignore quota errors
        }
        await autoHideInaccessibleZoho(fetched);
        refreshAccessibleTools();
      } else if (services.length === 0) {
        setServices(defaultServices);
      }
    } catch {
      if (services.length === 0) setServices(defaultServices);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const isServiceHidden = (key: string) => {
    if (key === "zoho") return ZOHO_SUB_TOOL_NAMES.every((t) => isHidden(t));
    const toolName = SERVICE_KEY_TO_TOOL_NAME[key];
    return toolName ? isHidden(toolName) : false;
  };

  const visibleServices = useMemo(
    () => services.filter((s) => !isServiceHidden(s.key)),
    [services, isHidden],
  );

  const stsService = !isHidden("STS")
    ? services.find((s) => s.key === "sts")
    : undefined;
  const calendarService = !isHidden("Outlook")
    ? services.find((s) => s.key === "outlook_calendar")
    : undefined;
  const emailService = !isHidden("Outlook")
    ? services.find((s) => s.key === "outlook_email")
    : undefined;
  const mainServices = useMemo(() => {
    const base = visibleServices.filter(
      (s) =>
        s.key !== "sts" &&
        s.key !== "outlook_calendar" &&
        s.key !== "outlook_email" &&
        s.key !== "zoho" &&
        !ZOHO_SUB_KEYS.includes(s.key as typeof ZOHO_SUB_KEYS[number]),
    );

    const zohoSuite = services.find((s) => s.key === "zoho");
    const allZohoHidden = ZOHO_SUB_TOOL_NAMES.every((t) => isHidden(t));
    if (!zohoSuite || allZohoHidden) return base;

    const subServices = services.filter((s) =>
      ZOHO_SUB_KEYS.includes(s.key as typeof ZOHO_SUB_KEYS[number]),
    );
    const accessibleSubs = subServices.filter((s) => s.accessible !== false);
    const visibleAccessibleSubs = accessibleSubs.filter(
      (s) => !isHidden(SERVICE_KEY_TO_TOOL_NAME[s.key]),
    );

    if (!zohoSuite.connected) {
      base.push(zohoSuite);
    } else if (accessibleSubs.length === 0) {
      // User connected Zoho but their email has no access to any sub — hide entirely.
    } else {
      base.push({ ...zohoSuite, subServices: visibleAccessibleSubs });
    }
    return base;
  }, [services, visibleServices, isHidden]);
  const showOutlookPanel = !isHidden("Outlook");
  const showStsPanel = !isHidden("STS");
  const connectedCount = services.filter(
    (s) =>
      s.connected &&
      !ZOHO_SUB_KEYS.includes(s.key as typeof ZOHO_SUB_KEYS[number]),
  ).length;
  const hasAnyVisibleWidget =
    mainServices.length > 0 || showStsPanel || showOutlookPanel;

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-background z-10">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Dashboard</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fetchDashboard({ fresh: true })}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            title={refreshing ? "Refreshing…" : "Refresh dashboard"}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className="relative" ref={toolMenuRef}>
            <button
              type="button"
              onClick={() => {
                setToolSettingsOpen((v) => {
                  if (!v) refreshAccessibleTools();
                  return !v;
                });
              }}
              aria-haspopup="menu"
              aria-expanded={toolSettingsOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground bg-muted/40 hover:bg-muted/70 border border-border/60 transition-colors"
            >
              Available tools
              <ChevronDown
                className={`w-3.5 h-3.5 opacity-70 transition-transform ${toolSettingsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {toolSettingsOpen && (
              <div
                role="menu"
                aria-label="Available tools"
                className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto bg-card border border-border rounded-xl shadow-lg z-30 p-3"
              >
                <ToolVisibilityPanel />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-8 py-6 md:py-8">
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
          ) : !hasAnyVisibleWidget ? (
            <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
              <Settings className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">All tools are hidden</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Re-enable a tool to see its widget on your dashboard.
              </p>
              <button
                onClick={() => setToolSettingsOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Settings className="w-4 h-4" />
                Open tool visibility
              </button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-start gap-6">
              {mainServices.length > 0 && (
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {mainServices.map((service) => {
                      const isZohoSuiteTile =
                        service.key === "zoho" &&
                        service.connected &&
                        (service.subServices?.length ?? 0) > 0;
                      return (
                        <div
                          key={service.key}
                          className={`h-full ${isZohoSuiteTile ? "md:col-span-2" : ""}`}
                        >
                          <ServiceCard
                            service={service}
                            onConnect={() => handleTileConnect(service.key)}
                            connecting={isTileConnecting(service.key)}
                            connectingLabel={tileConnectingLabel(service.key)}
                            tileError={tileErrors[service.key] ?? null}
                            onDisconnect={() => handleDisconnectTile(service.key)}
                            onUpdate={() => handleTileUpdate(service.key)}
                            onHide={() => handleHideTile(service.key)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(showStsPanel || showOutlookPanel) && (
                <div className="w-full lg:w-[340px] shrink-0 space-y-5">
                  {showStsPanel && (
                    <WeeklyHoursPanel
                      service={stsService}
                      onConnect={() => handleTileConnect("sts")}
                      connecting={isTileConnecting("sts")}
                      connectingLabel={tileConnectingLabel("sts")}
                      tileError={tileErrors.sts ?? null}
                      onDisconnect={() => handleDisconnectTile("sts")}
                      onUpdate={() => handleTileUpdate("sts")}
                      onHide={() => handleHideTile("sts")}
                    />
                  )}
                  {showOutlookPanel && (
                    <OutlookPanel
                      calendarService={calendarService}
                      emailService={emailService}
                      onConnect={onOpenConnections}
                      onHide={() => handleHideTile("outlook_email")}
                    />
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <ConnectServiceDialog
        provider={connectDialogProvider}
        token={token}
        open={connectDialogProvider !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConnectDialogProvider(null);
            setConnectDialogMode("connect");
          }
        }}
        onConnected={handleDialogConnected}
        onSavingChange={setDialogSaving}
        mode={connectDialogMode}
      />
      {connectMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm">
          <div
            className={`rounded-xl border shadow-lg px-4 py-3 text-sm flex items-start gap-3 ${
              connectMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            <span className="flex-1">{connectMessage.text}</span>
            <button
              type="button"
              onClick={() => setConnectMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
