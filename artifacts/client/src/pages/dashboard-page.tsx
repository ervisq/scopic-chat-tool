import { useState, useEffect, useMemo, type ComponentType, type SVGProps } from "react";
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
  X,
  Eye,
  ChevronRight,
  User,
  FolderOpen,
  CalendarClock,
  BarChart3,
  Settings,
  RefreshCw,
} from "lucide-react";
import { JiraIcon, TeamworkIcon, OutlookIcon, ZohoIcon, StsIcon } from "../components/chat/tool-icons";
import { safeExternalUrl } from "@/lib/utils";
import { useToolVisibility } from "@/lib/tool-visibility";
import { ToolVisibilityModal } from "@/components/tool-visibility-panel";
import { ConnectServiceDialog } from "@/components/connect-service-dialog";
import { DashboardTileMenu } from "@/components/dashboard-tile-menu";
import { toast } from "@/hooks/use-toast";
import {
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
  onOpenChat: () => void;
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
  jira: (instanceUrl) => instanceUrl || "https://www.atlassian.com/software/jira",
  zoho_people: () => "https://people.zoho.com",
  zoho_crm: () => "https://crm.zoho.com",
  zoho_recruit: () => "https://recruit.zoho.com",
  zoho_contracts: () => "https://contracts.zoho.com",
  zoho: () => "https://www.zoho.com",
  sts: (instanceUrl) => instanceUrl || "https://time.scopicsoftware.com",
  teamwork: (instanceUrl) => instanceUrl || "https://www.teamwork.com",
  outlook_email: () => "https://outlook.office.com/mail",
  outlook_calendar: () => "https://outlook.office.com/calendar",
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
      <Filter className={`w-3.5 h-3.5 ${accentColor} shrink-0`} />
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter by project"
        className="text-xs bg-muted/40 border border-border/50 rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 truncate max-w-[220px]"
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

function ExpandableJiraRow({
  ticket,
  instanceUrl,
}: {
  ticket: JiraTicketSummary;
  instanceUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const jiraBase = instanceUrl ? safeExternalUrl(instanceUrl) : "";
  const ticketUrl = jiraBase ? `${jiraBase}/browse/${ticket.id}` : "";

  return (
    <div className="rounded-lg bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 py-2 px-3">
        <button
          type="button"
          className="shrink-0 p-0 bg-transparent border-none cursor-pointer"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${ticket.title}`}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
        <PriorityDot priority={ticket.priority} />
        <span className="text-xs font-mono text-muted-foreground shrink-0">{ticket.id}</span>
        {ticketUrl ? (
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-foreground truncate flex-1 hover:underline hover:text-blue-600 dark:hover:text-blue-400"
          >
            {ticket.title}
          </a>
        ) : (
          <span className="text-xs text-foreground truncate flex-1">{ticket.title}</span>
        )}
        <StatusBadge status={ticket.status} />
      </div>
      {open && (
        <div className="px-3 pb-2.5 pt-0.5 ml-6 space-y-1.5 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3 shrink-0" />
            <span>{ticket.assignee || "Unassigned"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span>{ticket.project || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Priority:</span>
            <span>{ticket.priority}</span>
          </div>
          {ticketUrl && (
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1"
            >
              Open in Jira <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ExpandableTeamworkRow({
  task,
  instanceUrl,
}: {
  task: TeamworkTaskSummary;
  instanceUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const twBase = instanceUrl ? safeExternalUrl(instanceUrl) : "";
  const taskUrl = twBase ? `${twBase}/app/tasks/${task.id}` : "";

  return (
    <div className="rounded-lg bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 py-2 px-3">
        <button
          type="button"
          className="shrink-0 p-0 bg-transparent border-none cursor-pointer"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${task.title}`}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
        <PriorityDot priority={task.priority} />
        <span className="text-xs font-mono text-muted-foreground shrink-0">#{task.id}</span>
        {taskUrl ? (
          <a
            href={taskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-foreground truncate flex-1 hover:underline hover:text-purple-600 dark:hover:text-purple-400"
          >
            {task.title}
          </a>
        ) : (
          <span className="text-xs text-foreground truncate flex-1">{task.title}</span>
        )}
        <StatusBadge status={task.status} />
      </div>
      {open && (
        <div className="px-3 pb-2.5 pt-0.5 ml-6 space-y-1.5 border-t border-border/30">
          {task.assignee && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3 h-3 shrink-0" />
              <span>{task.assignee}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span>{task.projectName || "—"}{task.taskListName ? ` / ${task.taskListName}` : ""}</span>
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="w-3 h-3 shrink-0" />
              <span>Due: {formatDueDate(task.dueDate)}</span>
            </div>
          )}
          {task.progress !== undefined && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="w-3 h-3 shrink-0" />
              <span>Progress: {task.progress}%</span>
            </div>
          )}
          {taskUrl && (
            <a
              href={taskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline mt-1"
            >
              Open in Teamwork <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ExpandableEmailRow({ email }: { email: OutlookEmailSummary }) {
  const [open, setOpen] = useState(false);
  const emailUrl = email.id
    ? `https://outlook.office.com/mail/inbox/id/${encodeURIComponent(email.id)}`
    : "";

  return (
    <div className={`rounded-lg bg-muted/30 overflow-hidden ${!email.isRead ? "border-l-2 border-sky-500" : ""}`}>
      <div className="flex items-center gap-2 py-2 px-3">
        <button
          type="button"
          className="shrink-0 p-0 bg-transparent border-none cursor-pointer"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${email.subject}`}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
        {!email.isRead && <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />}
        {emailUrl ? (
          <a
            href={emailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm truncate flex-1 hover:underline hover:text-sky-600 dark:hover:text-sky-400 ${!email.isRead ? "font-semibold text-foreground" : "text-foreground"}`}
          >
            {email.subject}
          </a>
        ) : (
          <span className={`text-sm truncate flex-1 ${!email.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>
            {email.subject}
          </span>
        )}
        {email.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </div>
      {open && (
        <div className="px-3 pb-2.5 pt-0.5 ml-6 space-y-1.5 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{email.from}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{email.receivedAt ? formatRelativeTime(email.receivedAt) : "Unknown"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3 h-3 shrink-0" />
            <span>{email.isRead ? "Read" : "Unread"}{email.hasAttachments ? " · Has attachments" : ""}</span>
          </div>
          {email.preview && (
            <p className="text-xs text-muted-foreground/80 italic line-clamp-3 mt-1">{email.preview}</p>
          )}
          {emailUrl && (
            <a
              href={emailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline mt-1"
            >
              Open in Outlook <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ExpandableEventRow({ event }: { event: OutlookEventSummary }) {
  const [open, setOpen] = useState(false);
  const eventUrl = event.id
    ? `https://outlook.office.com/calendar/item/${encodeURIComponent(event.id)}`
    : "";

  return (
    <div className="rounded-lg bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 py-2 px-3">
        <button
          type="button"
          className="shrink-0 p-0 bg-transparent border-none cursor-pointer"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${event.subject}`}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
        {eventUrl ? (
          <a
            href={eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground truncate flex-1 hover:underline hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {event.subject}
          </a>
        ) : (
          <span className="text-sm font-medium text-foreground truncate flex-1">{event.subject}</span>
        )}
      </div>
      {open && (
        <div className="px-3 pb-2.5 pt-0.5 ml-6 space-y-1.5 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>
              {event.isAllDay
                ? formatEventDate(event.startTime)
                : `${formatEventDateTime(event.startTime)} – ${formatEventDateTime(event.endTime)}`}
            </span>
          </div>
          {event.location?.displayName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.location.displayName}</span>
            </div>
          )}
          {event.organizer && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3 h-3 shrink-0" />
              <span>Organizer: {event.organizer}</span>
            </div>
          )}
          {eventUrl && (
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
            >
              Open in Outlook <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function WeeklyHoursPanel({
  service,
  onConnect,
  connecting = false,
  connectingLabel = "Connecting…",
  tileError = null,
  onDisconnect,
  onHide,
}: {
  service: ServiceData | undefined;
  onConnect: () => void;
  connecting?: boolean;
  connectingLabel?: string;
  tileError?: string | null;
  onDisconnect: () => void;
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
              <h3 className="font-semibold text-foreground text-sm">Hours This Week</h3>
              {isConnected ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400">STS Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">STS Not connected</span>
                </div>
              )}
            </div>
          </div>
          <DashboardTileMenu
            connected={isConnected}
            onDisconnect={onDisconnect}
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

        {isConnected ? (
          <a
            href={stsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:opacity-80"
          >
            Open STS
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
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
  onViewMore,
  onConnect,
  onHide,
}: {
  calendarService: ServiceData | undefined;
  emailService: ServiceData | undefined;
  onViewMore: () => void;
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
              <h3 className="font-semibold text-foreground text-sm">Outlook</h3>
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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {emails.map((email, idx) => (
                      <div
                        key={idx}
                        className={`py-2 px-3 rounded-lg bg-muted/30 ${!email.isRead ? "border-l-2 border-sky-500" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          {!email.isRead && <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />}
                          {email.id ? (
                            <a
                              href={`https://outlook.office.com/mail/inbox/id/${encodeURIComponent(email.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-sm truncate flex-1 hover:underline hover:text-sky-600 dark:hover:text-sky-400 ${!email.isRead ? "font-semibold text-foreground" : "text-foreground"}`}
                            >
                              {email.subject}
                            </a>
                          ) : (
                            <span className={`text-sm truncate flex-1 ${!email.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>
                              {email.subject}
                            </span>
                          )}
                          {email.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground truncate">{email.from}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {email.receivedAt ? formatRelativeTime(email.receivedAt) : ""}
                          </span>
                        </div>
                      </div>
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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
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

        {isConnected ? (
          <div className="flex gap-2 mt-4">
            <button
              onClick={onViewMore}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:opacity-80"
            >
              <Eye className="w-4 h-4" />
              View more
            </button>
            <a
              href="https://outlook.office.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:opacity-80"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
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

function ServiceCard({
  service,
  onConnect,
  onViewMore,
  connecting = false,
  connectingLabel = "Connecting…",
  tileError = null,
  onDisconnect,
  onHide,
}: {
  service: ServiceData;
  onConnect: () => void;
  onViewMore: () => void;
  connecting?: boolean;
  connectingLabel?: string;
  tileError?: string | null;
  onDisconnect: () => void;
  onHide: () => void;
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
  const PREVIEW_LIMIT = 8;
  const previewTickets = service.key === "jira" ? (service.summary?.tickets || []).slice(0, PREVIEW_LIMIT) : [];
  const previewTasks = service.key === "teamwork" ? (service.summary?.tasks || []).slice(0, PREVIEW_LIMIT) : [];
  const totalTickets = service.summary?.tickets?.length || 0;
  const totalTasks = service.summary?.tasks?.length || 0;

  return (
    <div className={`rounded-2xl border ${style.borderColor} bg-card overflow-hidden transition-all hover:shadow-md`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-card flex items-center justify-center shadow-sm border border-border/50">
              <style.Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground text-base">{service.name}</h3>
                {service.connected && EXTERNAL_URLS[service.key] && (
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
            onHide={onHide}
            testId={`tile-menu-${service.key}`}
          />
        </div>

        {service.connected ? (
          <div className="space-y-3">
            {summaryText && (
              <div className={`rounded-lg ${style.bgColor} px-4 py-2.5`}>
                <p className={`text-sm font-medium ${service.error ? "text-muted-foreground italic" : style.textColor}`}>
                  {summaryText}
                </p>
              </div>
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
              <div className="space-y-1.5">
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
                {totalTickets > PREVIEW_LIMIT && (
                  <p className="text-xs text-muted-foreground text-center pt-1">+{totalTickets - PREVIEW_LIMIT} more</p>
                )}
              </div>
            )}

            {previewTasks.length > 0 && (
              <div className="space-y-1.5">
                {previewTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/30">
                    <PriorityDot priority={t.priority} />
                    <span className="text-xs font-mono text-muted-foreground shrink-0">#{t.id}</span>
                    {service.instanceUrl ? (
                      <a
                        href={`${service.instanceUrl}/app/tasks/${t.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground truncate flex-1 hover:underline hover:text-purple-600 dark:hover:text-purple-400"
                      >
                        {t.title}
                      </a>
                    ) : (
                      <span className="text-sm text-foreground truncate flex-1">{t.title}</span>
                    )}
                    <StatusBadge status={t.status} />
                  </div>
                ))}
                {totalTasks > PREVIEW_LIMIT && (
                  <p className="text-xs text-muted-foreground text-center pt-1">+{totalTasks - PREVIEW_LIMIT} more</p>
                )}
              </div>
            )}

            <div className="pt-1">
              <button
                onClick={onViewMore}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${style.bgColor} ${style.textColor} hover:opacity-80`}
              >
                <Eye className="w-4 h-4" />
                View more
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your {service.name} account to see your data here and use it in chat.
            </p>
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
  const [activeTab, setActiveTab] = useState<"emails" | "events">("emails");

  useEffect(() => {
    setProjectFilter("");
    setActiveTab("emails");
  }, [service?.key]);

  useEffect(() => {
    if (!service) return;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [service, onClose]);

  if (!service) return null;

  const style = SERVICE_STYLES[service.key] || SERVICE_STYLES.jira;
  const externalUrl = EXTERNAL_URLS[service.key]?.(service.instanceUrl) || (
    service.key === "outlook_email" || service.key === "outlook_calendar" ? "https://outlook.office.com" : "#"
  );

  const isOutlook = service.key === "outlook_email" || service.key === "outlook_calendar";

  const jiraProjects = service.key === "jira" && service.summary?.tickets
    ? [...new Set(service.summary.tickets.map((t) => t.project).filter(Boolean))].sort()
    : [];

  const teamworkProjects = service.key === "teamwork" && service.summary?.tasks
    ? [...new Set(service.summary.tasks.map((t) => t.projectName).filter(Boolean))].sort()
    : [];

  const filteredJiraTickets = service.summary?.tickets
    ? (projectFilter ? service.summary.tickets.filter((t) => t.project === projectFilter) : service.summary.tickets)
    : [];

  const filteredTeamworkTasks = service.summary?.tasks
    ? (projectFilter ? service.summary.tasks.filter((t) => t.projectName === projectFilter) : service.summary.tasks)
    : [];

  const emails = service.summary?.emails || [];
  const events = service.summary?.events || [];

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
            <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center shadow-sm border border-border/50">
              <style.Icon className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-foreground text-base">{service.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close drawer" className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {service.error && (
            <div className="rounded-lg bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground italic">{service.error}</p>
            </div>
          )}

          {service.key === "jira" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Tasks</p>
                {service.summary?.openTickets !== undefined && (
                  <span className={`text-xs font-semibold ${style.textColor}`}>{service.summary.openTickets} open</span>
                )}
              </div>
              <ProjectFilter projects={jiraProjects} selected={projectFilter} onChange={setProjectFilter} accentColor={style.textColor} />
              {filteredJiraTickets.length === 0 ? (
                <p className="text-xs text-muted-foreground">{projectFilter ? "No tasks in this project" : "No tasks found"}</p>
              ) : (
                <>
                  {filteredJiraTickets.map((t) => (
                    <ExpandableJiraRow key={t.id} ticket={t} instanceUrl={service.instanceUrl} />
                  ))}
                </>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use <span className="font-mono font-semibold">@JIRA</span> in chat for more
              </p>
            </div>
          )}

          {service.key === "teamwork" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Tasks</p>
                {service.summary?.activeTasks !== undefined && (
                  <span className={`text-xs font-semibold ${style.textColor}`}>{service.summary.activeTasks} active</span>
                )}
              </div>
              <ProjectFilter projects={teamworkProjects} selected={projectFilter} onChange={setProjectFilter} accentColor={style.textColor} />
              {filteredTeamworkTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">{projectFilter ? "No tasks in this project" : "No tasks found"}</p>
              ) : (
                <>
                  {filteredTeamworkTasks.map((t) => (
                    <ExpandableTeamworkRow key={t.id} task={t} instanceUrl={service.instanceUrl} />
                  ))}
                </>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use <span className="font-mono font-semibold">@Teamwork</span> in chat for more
              </p>
            </div>
          )}

          {isOutlook && (
            <div className="space-y-3">
              <div className="flex rounded-xl bg-muted/50 p-1 mb-2">
                <button
                  onClick={() => setActiveTab("emails")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === "emails"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Emails
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
                  Events
                </button>
              </div>

              {activeTab === "emails" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Emails</p>
                  {emails.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recent emails</p>
                  ) : (
                    emails.map((email, idx) => (
                      <ExpandableEmailRow key={idx} email={email} />
                    ))
                  )}
                </div>
              )}

              {activeTab === "events" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upcoming Events</p>
                  {events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No upcoming events</p>
                  ) : (
                    events.map((event, idx) => (
                      <ExpandableEventRow key={idx} event={event} />
                    ))
                  )}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Use <span className="font-mono font-semibold">@Outlook</span> in chat for more
              </p>
            </div>
          )}

          {service.key === "zoho_people" && (
            <div className="space-y-3">
              {service.summary?.status && (
                <div className={`rounded-lg ${style.bgColor} px-4 py-3`}>
                  <p className={`text-sm font-medium ${style.textColor}`}>{service.summary.status}</p>
                </div>
              )}
              {(service.summary?.onLeaveToday?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">On Leave Today</p>
                  {service.summary!.onLeaveToday!.map((l, i) => (
                    <div key={i} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{l.employee || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {l.leaveType || "Leave"}{l.from ? ` · ${l.from}${l.to && l.to !== l.from ? ` → ${l.to}` : ""}` : ""}{l.dayCount ? ` · ${l.dayCount} day${l.dayCount !== "1" ? "s" : ""}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {(service.summary?.recentJoiners?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Joiners (this month)</p>
                  {service.summary!.recentJoiners!.map((e) => (
                    <div key={e.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{e.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {e.designation || "—"}{e.department ? ` · ${e.department}` : ""}{e.dateOfJoining ? ` · joined ${e.dateOfJoining}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use <span className="font-mono font-semibold">@ZohoPeople</span> in chat to query data
              </p>
            </div>
          )}

          {service.key === "zoho_crm" && (
            <div className="space-y-3">
              {service.summary?.status && (
                <div className={`rounded-lg ${style.bgColor} px-4 py-3`}>
                  <p className={`text-sm font-medium ${style.textColor}`}>{service.summary.status}</p>
                </div>
              )}
              {(service.summary?.openDeals?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top Open Deals</p>
                  {service.summary!.openDeals!.map((d) => (
                    <div key={d.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-foreground truncate flex-1">{d.name || "Deal"}</p>
                        {d.amount && <span className="text-xs font-semibold text-foreground shrink-0">{d.amount}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.account || "—"}{d.stage ? ` · ${d.stage}` : ""}{d.closingDate ? ` · close ${d.closingDate}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {(service.summary?.recentLeads?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Leads (last 7 days)</p>
                  {service.summary!.recentLeads!.map((l) => (
                    <div key={l.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{l.name || l.email || "Lead"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {l.company || "—"}{l.leadStatus ? ` · ${l.leadStatus}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {(service.summary?.tasksDueToday?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tasks Due Today</p>
                  {service.summary!.tasksDueToday!.map((t) => (
                    <div key={t.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{t.subject || "Task"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.priority || "—"}{t.status ? ` · ${t.status}` : ""}{t.relatedTo ? ` · ${t.relatedTo}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use <span className="font-mono font-semibold">@ZohoCRM</span> in chat to query data
              </p>
            </div>
          )}

          {service.key === "zoho_recruit" && (
            <div className="space-y-3">
              {service.summary?.status && (
                <div className={`rounded-lg ${style.bgColor} px-4 py-3`}>
                  <p className={`text-sm font-medium ${style.textColor}`}>{service.summary.status}</p>
                </div>
              )}
              {(service.summary?.jobOpenings?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Positions</p>
                  {service.summary!.jobOpenings!.map((j) => (
                    <div key={j.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{j.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {j.department || "—"}{j.positions ? ` · ${j.positions} position${j.positions !== "1" ? "s" : ""}` : ""}{j.status ? ` · ${j.status}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {(service.summary?.upcomingInterviews?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interviews this week</p>
                  {service.summary!.upcomingInterviews!.map((iv) => (
                    <div key={iv.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{iv.candidateName || iv.interviewName || "Interview"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {iv.interviewDate || "—"}{iv.from ? ` · ${iv.from}${iv.to ? `–${iv.to}` : ""}` : ""}{iv.jobOpeningName ? ` · ${iv.jobOpeningName}` : ""}{iv.status ? ` · ${iv.status}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {(service.summary?.candidates?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Candidates</p>
                  {service.summary!.candidates!.map((c) => (
                    <div key={c.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{c.name || c.email || "Candidate"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.currentJobTitle || "—"}{c.currentEmployer ? ` @ ${c.currentEmployer}` : ""}{c.status ? ` · ${c.status}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use <span className="font-mono font-semibold">@ZohoRecruit</span> in chat for more
              </p>
            </div>
          )}

          {service.key === "zoho_contracts" && (
            <div className="space-y-3">
              {service.summary?.status && (
                <div className={`rounded-lg ${style.bgColor} px-4 py-3`}>
                  <p className={`text-sm font-medium ${style.textColor}`}>{service.summary.status}</p>
                </div>
              )}
              {(service.summary?.expiringContracts?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expiring soon (next 30 days)</p>
                  {service.summary!.expiringContracts!.map((c) => (
                    <div key={c.id} className="py-1.5 px-3 rounded-lg bg-amber-100/40 dark:bg-amber-900/20">
                      <p className="text-sm text-foreground truncate">{c.contractName || "Contract"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.company || "—"}{c.endDate ? ` · ends ${c.endDate}` : ""}{c.contractValue ? ` · ${c.contractValue}` : ""}{c.contractStatus ? ` · ${c.contractStatus}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {(service.summary?.contracts?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contracts</p>
                  {service.summary!.contracts!.map((c) => (
                    <div key={c.id} className="py-1.5 px-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground truncate">{c.contractName || "Contract"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.company || "—"}{c.contractStatus ? ` · ${c.contractStatus}` : ""}{c.endDate ? ` · ends ${c.endDate}` : ""}{c.contractValue ? ` · ${c.contractValue}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use <span className="font-mono font-semibold">@ZohoContracts</span> in chat for more
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
  onOpenChat,
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
  const [drawerService, setDrawerService] = useState<ServiceData | null>(null);
  const [toolSettingsOpen, setToolSettingsOpen] = useState(false);
  const [connectDialogProvider, setConnectDialogProvider] = useState<ProviderConfig | null>(null);
  const [connectMessage, setConnectMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tileConnectingKey, setTileConnectingKey] = useState<string | null>(null);
  const [tileErrors, setTileErrors] = useState<Record<string, string>>({});
  const [dialogSaving, setDialogSaving] = useState(false);
  const { isHidden, setHidden, refreshConnectedTools } = useToolVisibility();

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

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
    setConnectMessage({ type: "success", text: `${connectDialogProvider?.name ?? "Service"} connected successfully` });
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

  function openOutlookDrawer() {
    const emailSvc = services.find((s) => s.key === "outlook_email");
    const calSvc = services.find((s) => s.key === "outlook_calendar");
    const merged: ServiceData = {
      key: "outlook_email",
      name: "Outlook",
      connected: (emailSvc?.connected ?? false) || (calSvc?.connected ?? false),
      summary: {
        emails: emailSvc?.summary?.emails,
        events: calSvc?.summary?.events,
      },
      error: emailSvc?.error || calSvc?.error,
    };
    setDrawerService(merged);
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
      base.push({
        ...zohoSuite,
        connected: true,
        error:
          "Connected, but your Zoho account doesn't have access to People, CRM, Recruit or Contracts.",
      });
    } else {
      base.push(...visibleAccessibleSubs);
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
          <button
            type="button"
            onClick={() => setToolSettingsOpen(true)}
            aria-label="Tool visibility"
            title="Tool visibility"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
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
                    {mainServices.map((service) => (
                      <ServiceCard
                        key={service.key}
                        service={service}
                        onConnect={() => handleTileConnect(service.key)}
                        onViewMore={() => setDrawerService(service)}
                        connecting={isTileConnecting(service.key)}
                        connectingLabel={tileConnectingLabel(service.key)}
                        tileError={tileErrors[service.key] ?? null}
                        onDisconnect={() => handleDisconnectTile(service.key)}
                        onHide={() => handleHideTile(service.key)}
                      />
                    ))}
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
                      onHide={() => handleHideTile("sts")}
                    />
                  )}
                  {showOutlookPanel && (
                    <OutlookPanel
                      calendarService={calendarService}
                      emailService={emailService}
                      onViewMore={openOutlookDrawer}
                      onConnect={onOpenConnections}
                      onHide={() => handleHideTile("outlook_email")}
                    />
                  )}
                </div>
              )}
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
      <ToolVisibilityModal
        open={toolSettingsOpen}
        onClose={() => setToolSettingsOpen(false)}
      />
      <ConnectServiceDialog
        provider={connectDialogProvider}
        token={token}
        open={connectDialogProvider !== null}
        onOpenChange={(open) => {
          if (!open) setConnectDialogProvider(null);
        }}
        onConnected={handleDialogConnected}
        onSavingChange={setDialogSaving}
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
