import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { safeExternalUrl } from "@/lib/utils";
import {
  ExternalLink,
  User,
  FolderOpen,
  CalendarClock,
  BarChart3,
  Tag,
  MessageSquare,
  Mail,
  Paperclip,
  Calendar,
  Users,
  Search,
  CircleDot,
  Flag,
} from "lucide-react";

export interface ZohoRecruitCandidateData {
  id: string;
  name: string;
  email: string;
  status: string;
  currentJobTitle: string;
  currentEmployer: string;
}

export interface ZohoRecruitJobData {
  id: string;
  title: string;
  department: string;
  status: string;
  positions: string;
}

export interface ZohoRecruitInterviewData {
  id: string;
  interviewName: string;
  candidateName: string;
  interviewDate: string;
  from: string;
  to: string;
  jobOpeningName: string;
  status: string;
}

export interface ZohoCrmDealData {
  id: string;
  name: string;
  stage: string;
  amount: string;
  closingDate: string;
  account: string;
}

export interface ZohoCrmLeadData {
  id: string;
  name: string;
  company: string;
  leadStatus: string;
  email: string;
}

export interface ZohoCrmTaskData {
  id: string;
  subject: string;
  status: string;
  priority: string;
  relatedTo: string;
}

export interface ZohoContractData {
  id: string;
  contractName: string;
  contractType: string;
  contractStatus: string;
  company: string;
  startDate: string;
  endDate: string;
  contractValue: string;
}

export interface ZohoPeopleLeaveData {
  employee: string;
  leaveType: string;
  from: string;
  to: string;
  dayCount: string;
}

export interface ZohoPeopleJoinerData {
  id: string;
  name: string;
  designation: string;
  department: string;
  dateOfJoining: string;
}

export type DetailTarget =
  | {
      type: "teamwork_task";
      id: number;
      openUrl?: string | null;
      label?: string;
      status?: string;
    }
  | {
      type: "outlook_email";
      id: string;
      openUrl?: string | null;
      label?: string;
      unread?: boolean;
    }
  | {
      type: "jira_issue";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
    }
  | {
      type: "zoho_recruit_candidate";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoRecruitCandidateData;
    }
  | {
      type: "zoho_recruit_job";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoRecruitJobData;
    }
  | {
      type: "zoho_recruit_interview";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoRecruitInterviewData;
    }
  | {
      type: "zoho_crm_deal";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoCrmDealData;
    }
  | {
      type: "zoho_crm_lead";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoCrmLeadData;
    }
  | {
      type: "zoho_crm_task";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoCrmTaskData;
    }
  | {
      type: "zoho_contract";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoContractData;
    }
  | {
      type: "zoho_people_leave";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoPeopleLeaveData;
    }
  | {
      type: "zoho_people_joiner";
      id: string;
      openUrl?: string | null;
      label?: string;
      status?: string;
      data: ZohoPeopleJoinerData;
    };

interface ObjectDetailContextValue {
  /** Open the popup for a single object (no list pane) — used by chat. */
  openDetail: (target: DetailTarget) => void;
  /**
   * Open the master-detail popup with a list of sibling objects, pre-selecting
   * the one at `index`. Used by dashboard tiles.
   */
  openDetailList: (targets: DetailTarget[], index: number) => void;
}

const ObjectDetailContext = createContext<ObjectDetailContextValue | null>(null);

export function useObjectDetail(): ObjectDetailContextValue {
  const ctx = useContext(ObjectDetailContext);
  if (!ctx) {
    throw new Error("useObjectDetail must be used within an ObjectDetailProvider");
  }
  return ctx;
}

interface TeamworkTaskDetail {
  task: {
    id: number;
    name: string;
    description: string;
    status: string;
    assignee: string;
    priority: string;
    dueDate: string;
    startDate: string;
    progress: number;
    estimatedMinutes: number;
    projectName: string;
    taskListName: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    commentCount: number;
  };
  comments: Array<{
    id: number;
    body: string;
    author: string;
    createdAt: string;
  }>;
  instanceUrl: string;
}

interface MailDetail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  bodyContentType: "html" | "text";
  bodyContent: string;
  attachments: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
}

interface JiraIssueDetail {
  issue: {
    id: string;
    summary: string;
    status: string;
    assignee: string;
    priority: string;
    project: string;
    issueType: string;
    description: string;
    reporter: string;
    created: string;
    updated: string;
    dueDate: string;
    labels: string[];
  };
  comments: Array<{
    id: string;
    body: string;
    author: string;
    createdAt: string;
  }>;
  instanceUrl: string | null;
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = DOMPurify.sanitize(html);
  return (tmp.textContent || tmp.innerText || "").trim();
}

export function ObjectDetailProvider({
  token,
  children,
}: {
  token: string | null | undefined;
  children: React.ReactNode;
}) {
  const [targets, setTargets] = useState<DetailTarget[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showList, setShowList] = useState(false);
  const [open, setOpen] = useState(false);

  const openDetail = useCallback((next: DetailTarget) => {
    setTargets([next]);
    setActiveIndex(0);
    setShowList(false);
    setOpen(true);
  }, []);

  const openDetailList = useCallback(
    (next: DetailTarget[], index: number) => {
      if (next.length === 0) return;
      const safeIndex = Math.min(Math.max(index, 0), next.length - 1);
      setTargets(next);
      setActiveIndex(safeIndex);
      setShowList(true);
      setOpen(true);
    },
    [],
  );

  const markTargetEmailRead = useCallback((id: string) => {
    setTargets((prev) =>
      prev.map((t) =>
        t.type === "outlook_email" && t.id === id ? { ...t, unread: false } : t,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({ openDetail, openDetailList }),
    [openDetail, openDetailList],
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Keep targets briefly so the close animation doesn't flash empty content.
      setTimeout(() => {
        setTargets([]);
        setActiveIndex(0);
        setShowList(false);
      }, 200);
    }
  }

  const activeTarget = targets[activeIndex] ?? null;

  return (
    <ObjectDetailContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`${
            showList ? "max-w-4xl" : "max-w-2xl"
          } max-h-[85vh] overflow-hidden flex flex-col`}
        >
          {!activeTarget ? (
            <DialogHeader>
              <DialogTitle>Details</DialogTitle>
            </DialogHeader>
          ) : showList ? (
            <div className="flex flex-col sm:flex-row gap-0 sm:gap-4 flex-1 min-h-0 overflow-hidden -m-6">
              <DetailList
                targets={targets}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
              />
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 sm:pl-0">
                <DetailBody
                  key={`${activeTarget.type}-${activeTarget.id}`}
                  target={activeTarget}
                  token={token}
                  onEmailRead={markTargetEmailRead}
                />
              </div>
            </div>
          ) : (
            <DetailBody
              target={activeTarget}
              token={token}
              onEmailRead={markTargetEmailRead}
            />
          )}
        </DialogContent>
      </Dialog>
    </ObjectDetailContext.Provider>
  );
}

function DetailList({
  targets,
  activeIndex,
  onSelect,
}: {
  targets: DetailTarget[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const listType = targets[0]?.type;
  const isEmailList = listType === "outlook_email";
  const isStatusList = listType === "teamwork_task" || listType === "jira_issue";

  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statusOptions = useMemo(() => {
    if (!isStatusList) return [];
    const seen = new Set<string>();
    for (const t of targets) {
      if ((t.type === "teamwork_task" || t.type === "jira_issue") && t.status) {
        seen.add(t.status);
      }
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [targets, isStatusList]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return targets
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => {
        if (term) {
          const haystack = `${t.label || ""} ${t.id}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        if (isEmailList && t.type === "outlook_email" && readFilter !== "all") {
          const unread = !!t.unread;
          if (readFilter === "unread" && !unread) return false;
          if (readFilter === "read" && unread) return false;
        }
        if (
          isStatusList &&
          statusFilter !== "all" &&
          (t.type === "teamwork_task" || t.type === "jira_issue")
        ) {
          if ((t.status || "") !== statusFilter) return false;
        }
        return true;
      });
  }, [targets, search, readFilter, statusFilter, isEmailList, isStatusList]);

  const readFilters: Array<{ value: "all" | "unread" | "read"; label: string }> = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "read", label: "Read" },
  ];

  return (
    <div className="shrink-0 sm:w-72 flex flex-col border-b sm:border-b-0 sm:border-r border-border bg-muted/20 overflow-hidden max-h-60 sm:max-h-none">
      <div className="px-3 pt-4 pb-2 shrink-0 space-y-2.5">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Items ({visible.length}
          {visible.length !== targets.length ? ` / ${targets.length}` : ""})
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-border bg-background pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {isEmailList && (
          <div className="flex items-center gap-1 rounded-md bg-muted/60 p-0.5">
            {readFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setReadFilter(f.value)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium cursor-pointer border-none transition-colors ${
                  readFilter === f.value
                    ? "bg-background text-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {isStatusList && statusOptions.length > 0 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <p className="text-sm text-muted-foreground text-center">No matches</p>
        </div>
      ) : (
        <ul className="overflow-y-auto flex-1 px-2 pb-2 space-y-0.5">
          {visible.map(({ t, i }) => {
            const active = i === activeIndex;
            const isEmail = t.type === "outlook_email";
            const isJira = t.type === "jira_issue";
            const isZoho = t.type.startsWith("zoho_");
            const label =
              t.label ||
              (isEmail
                ? "(No Subject)"
                : isZoho
                  ? "(Item)"
                  : `${isJira ? "" : "#"}${t.id}`);
            return (
              <li key={`${t.type}-${t.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-current={active ? "true" : undefined}
                  className={`w-full text-left rounded-md px-2.5 py-2 cursor-pointer border-none transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-transparent hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isEmail ? (
                      <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    ) : isZoho ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                        {isJira ? t.id : `#${t.id}`}
                      </span>
                    )}
                    <span
                      className={`text-sm truncate flex-1 ${
                        isEmail && t.unread ? "font-semibold" : ""
                      }`}
                    >
                      {label}
                    </span>
                    {isEmail && t.unread && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                    )}
                  </div>
                  {"status" in t && t.status && (
                    <span className="mt-1 inline-block text-[10px] font-medium text-muted-foreground">
                      {t.status}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DetailBody({
  target,
  token,
  onEmailRead,
}: {
  target: DetailTarget;
  token: string | null | undefined;
  onEmailRead?: (id: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamwork, setTeamwork] = useState<TeamworkTaskDetail | null>(null);
  const [email, setEmail] = useState<MailDetail | null>(null);
  const [jira, setJira] = useState<JiraIssueDetail | null>(null);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setTeamwork(null);
      setEmail(null);
      setJira(null);
      if (target.type.startsWith("zoho_")) {
        // Zoho detail is rendered from data already loaded on the dashboard;
        // there is no per-record fetch.
        setLoading(false);
        return;
      }
      try {
        let url: string;
        if (target.type === "teamwork_task") {
          url = `${baseUrl}/api/details/teamwork/task/${target.id}`;
        } else if (target.type === "jira_issue") {
          url = `${baseUrl}/api/details/jira/issue/${encodeURIComponent(target.id)}`;
        } else {
          url = `${baseUrl}/api/details/outlook/email?id=${encodeURIComponent(target.id)}`;
        }
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          let message = "Could not load details.";
          try {
            const body = await res.json();
            if (body?.message) message = body.message;
          } catch {
            // ignore json parse errors
          }
          if (!cancelled) setError(message);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (target.type === "teamwork_task") {
          setTeamwork(data as TeamworkTaskDetail);
        } else if (target.type === "jira_issue") {
          setJira(data as JiraIssueDetail);
        } else {
          const mail = data as MailDetail;
          setEmail(mail);
          if (target.type === "outlook_email" && !mail.isRead) {
            const emailId = target.id;
            fetch(`${baseUrl}/api/details/outlook/email/read`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ id: emailId }),
            })
              .then((r) => {
                if (!r.ok) return;
                if (!cancelled) {
                  setEmail((prev) => (prev ? { ...prev, isRead: true } : prev));
                }
                onEmailRead?.(emailId);
                window.dispatchEvent(
                  new CustomEvent("outlook:email-read", {
                    detail: { id: emailId },
                  }),
                );
              })
              .catch(() => {
                /* mark-as-read is best-effort; ignore failures */
              });
          }
        }
      } catch {
        if (!cancelled) setError("Could not load details. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [target, token, baseUrl, onEmailRead]);

  if (loading) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Loading…</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Unable to load details</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-4">{error}</p>
      </>
    );
  }

  if (teamwork) {
    return <TeamworkTaskDetailView detail={teamwork} openUrl={target.openUrl} />;
  }

  if (email) {
    return <OutlookEmailDetailView detail={email} openUrl={target.openUrl} />;
  }

  if (jira) {
    return <JiraIssueDetailView detail={jira} openUrl={target.openUrl} />;
  }

  switch (target.type) {
    case "zoho_recruit_candidate":
      return <ZohoRecruitCandidateDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_recruit_job":
      return <ZohoRecruitJobDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_recruit_interview":
      return <ZohoRecruitInterviewDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_crm_deal":
      return <ZohoCrmDealDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_crm_lead":
      return <ZohoCrmLeadDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_crm_task":
      return <ZohoCrmTaskDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_contract":
      return <ZohoContractDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_people_leave":
      return <ZohoPeopleLeaveDetailView data={target.data} openUrl={target.openUrl} />;
    case "zoho_people_joiner":
      return <ZohoPeopleJoinerDetailView data={target.data} openUrl={target.openUrl} />;
    default:
      break;
  }

  return (
    <DialogHeader>
      <DialogTitle>Details</DialogTitle>
    </DialogHeader>
  );
}

function OpenInButton({ href, label }: { href: string; label: string }) {
  const safe = safeExternalUrl(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      {label} <ExternalLink className="w-3.5 h-3.5" />
    </a>
  );
}

function DetailFooter({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  return (
    <div className="pt-2 border-t border-border flex justify-end">
      <OpenInButton href={href} label={label} />
    </div>
  );
}

function DetailRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function TeamworkTaskDetailView({
  detail,
  openUrl,
}: {
  detail: TeamworkTaskDetail;
  openUrl?: string | null;
}) {
  const { task, comments, instanceUrl } = detail;
  const twBase = instanceUrl ? safeExternalUrl(instanceUrl) : "";
  const href = openUrl || (twBase ? `${twBase}/app/tasks/${task.id}` : "");
  const description = task.description ? stripHtml(task.description) : "";

  return (
    <>
      <DialogHeader className="pb-3 mb-3 border-b border-border">
        <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
          Teamwork · #{task.id}
        </p>
        <DialogTitle className="pr-8 break-words text-lg leading-snug">
          {task.name}
        </DialogTitle>
      </DialogHeader>

      <div className="overflow-y-auto flex-1 space-y-3 pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
            {task.status || "unknown"}
          </span>
          {task.priority && task.priority !== "none" && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
              {task.priority} priority
            </span>
          )}
        </div>

        {task.assignee && (
          <DetailRow icon={<User className="w-4 h-4" />}>{task.assignee}</DetailRow>
        )}
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          {task.projectName || "—"}
          {task.taskListName ? ` / ${task.taskListName}` : ""}
        </DetailRow>
        {task.dueDate && (
          <DetailRow icon={<CalendarClock className="w-4 h-4" />}>
            Due: {formatDateTime(task.dueDate)}
          </DetailRow>
        )}
        <DetailRow icon={<BarChart3 className="w-4 h-4" />}>
          Progress: {task.progress || 0}%
        </DetailRow>
        {task.tags && task.tags.length > 0 && (
          <DetailRow icon={<Tag className="w-4 h-4" />}>
            {task.tags.join(", ")}
          </DetailRow>
        )}

        {description && (
          <div className="pt-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Description
            </h4>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
              {description}
            </p>
          </div>
        )}

        <div className="pt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({comments.length})
          </h4>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments.</p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {c.author || "Unknown"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {c.body ? stripHtml(c.body) : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {href && (
        <div className="pt-2 border-t border-border flex justify-end">
          <OpenInButton href={href} label="Open in Teamwork" />
        </div>
      )}
    </>
  );
}

function JiraIssueDetailView({
  detail,
  openUrl,
}: {
  detail: JiraIssueDetail;
  openUrl?: string | null;
}) {
  const { issue, comments, instanceUrl } = detail;
  const jiraBase = instanceUrl ? safeExternalUrl(instanceUrl) : "";
  const href = openUrl || (jiraBase ? `${jiraBase}/browse/${issue.id}` : "");

  return (
    <>
      <DialogHeader className="pb-3 mb-3 border-b border-border">
        <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
          Jira · {issue.id}
          {issue.issueType ? ` · ${issue.issueType}` : ""}
        </p>
        <DialogTitle className="pr-8 break-words text-lg leading-snug">
          {issue.summary}
        </DialogTitle>
      </DialogHeader>

      <div className="overflow-y-auto flex-1 space-y-3 pr-1">
        <div className="flex flex-wrap items-center gap-2">
          {issue.status && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              <CircleDot className="w-3 h-3" />
              {issue.status}
            </span>
          )}
          {issue.priority && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              <Flag className="w-3 h-3" />
              {issue.priority}
            </span>
          )}
        </div>

        {issue.assignee && (
          <DetailRow icon={<User className="w-4 h-4" />}>
            <span className="font-medium text-foreground">Assignee:</span>{" "}
            {issue.assignee}
          </DetailRow>
        )}
        {issue.reporter && (
          <DetailRow icon={<Users className="w-4 h-4" />}>
            <span className="font-medium text-foreground">Reporter:</span>{" "}
            {issue.reporter}
          </DetailRow>
        )}
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          {issue.project || "—"}
        </DetailRow>
        {issue.dueDate && (
          <DetailRow icon={<CalendarClock className="w-4 h-4" />}>
            Due: {formatDateTime(issue.dueDate)}
          </DetailRow>
        )}
        {issue.updated && (
          <DetailRow icon={<Calendar className="w-4 h-4" />}>
            Updated: {formatDateTime(issue.updated)}
          </DetailRow>
        )}
        {issue.labels && issue.labels.length > 0 && (
          <DetailRow icon={<Tag className="w-4 h-4" />}>
            {issue.labels.join(", ")}
          </DetailRow>
        )}

        {issue.description && (
          <div className="pt-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Description
            </h4>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
              {issue.description}
            </p>
          </div>
        )}

        <div className="pt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({comments.length})
          </h4>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments.</p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {c.author || "Unknown"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {href && (
        <div className="pt-2 border-t border-border flex justify-end">
          <OpenInButton href={href} label="Open in Jira" />
        </div>
      )}
    </>
  );
}

function OutlookEmailDetailView({
  detail,
  openUrl,
}: {
  detail: MailDetail;
  openUrl?: string | null;
}) {
  const href =
    openUrl ||
    (detail.id
      ? `https://outlook.office.com/mail/inbox/id/${encodeURIComponent(detail.id)}`
      : "");

  const sanitizedHtml = useMemo(() => {
    if (detail.bodyContentType !== "html") return null;
    return DOMPurify.sanitize(detail.bodyContent || "", {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target"],
      FORBID_TAGS: ["style"],
    });
  }, [detail.bodyContent, detail.bodyContentType]);

  return (
    <>
      <DialogHeader className="pb-3 mb-3 border-b border-border">
        <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
          Outlook · Email
        </p>
        <DialogTitle className="pr-8 break-words text-lg leading-snug">
          {detail.subject || "(No Subject)"}
        </DialogTitle>
      </DialogHeader>

      <div className="overflow-y-auto flex-1 space-y-3 pr-1">
        <DetailRow icon={<User className="w-4 h-4" />}>
          <span className="font-medium text-foreground">From:</span> {detail.from}
        </DetailRow>
        {detail.to.length > 0 && (
          <DetailRow icon={<Users className="w-4 h-4" />}>
            <span className="font-medium text-foreground">To:</span>{" "}
            {detail.to.join(", ")}
          </DetailRow>
        )}
        {detail.cc.length > 0 && (
          <DetailRow icon={<Users className="w-4 h-4" />}>
            <span className="font-medium text-foreground">Cc:</span>{" "}
            {detail.cc.join(", ")}
          </DetailRow>
        )}
        <DetailRow icon={<Calendar className="w-4 h-4" />}>
          {formatDateTime(detail.receivedAt)}
        </DetailRow>
        <DetailRow icon={<Mail className="w-4 h-4" />}>
          {detail.isRead ? "Read" : "Unread"}
        </DetailRow>

        {detail.attachments.length > 0 && (
          <div className="pt-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              Attachments ({detail.attachments.length})
            </h4>
            <ul className="space-y-1.5">
              {detail.attachments.map((a, idx) => (
                <li
                  key={a.id || idx}
                  className="flex items-center gap-2 text-sm text-foreground/90 rounded-lg bg-muted/40 px-2.5 py-1.5"
                >
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{a.name}</span>
                  {formatFileSize(a.size) && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatFileSize(a.size)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-1 border-t border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground my-2">
            Message
          </h4>
          {sanitizedHtml !== null ? (
            <div
              className="text-sm text-foreground/90 break-words [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_table]:max-w-full"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
              {detail.bodyContent}
            </p>
          )}
        </div>
      </div>

      {href && (
        <div className="pt-2 border-t border-border flex justify-end">
          <OpenInButton href={href} label="Open in Outlook" />
        </div>
      )}
    </>
  );
}

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
      {value}
    </span>
  );
}

function ZohoDetailShell({
  source,
  title,
  pills,
  href,
  openLabel,
  children,
}: {
  source: string;
  title: string;
  pills?: React.ReactNode;
  href: string;
  openLabel: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <DialogHeader className="pb-3 mb-3 border-b border-border">
        <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
          {source}
        </p>
        <DialogTitle className="pr-8 break-words text-lg leading-snug">
          {title}
        </DialogTitle>
      </DialogHeader>

      <div className="overflow-y-auto flex-1 space-y-3 pr-1">
        {pills && <div className="flex flex-wrap items-center gap-2">{pills}</div>}
        {children}
      </div>

      <DetailFooter href={href} label={openLabel} />
    </>
  );
}

function ZohoRecruitCandidateDetailView({
  data,
  openUrl,
}: {
  data: ZohoRecruitCandidateData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho Recruit · Candidate"
      title={data.name || "Candidate"}
      pills={<StatusPill value={data.status} />}
      href={openUrl || ""}
      openLabel="Open in Zoho Recruit"
    >
      {data.email && (
        <DetailRow icon={<Mail className="w-4 h-4" />}>{data.email}</DetailRow>
      )}
      {data.currentJobTitle && (
        <DetailRow icon={<BarChart3 className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Current title:</span>{" "}
          {data.currentJobTitle}
        </DetailRow>
      )}
      {data.currentEmployer && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Employer:</span>{" "}
          {data.currentEmployer}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoRecruitJobDetailView({
  data,
  openUrl,
}: {
  data: ZohoRecruitJobData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho Recruit · Job Opening"
      title={data.title || "Job Opening"}
      pills={<StatusPill value={data.status} />}
      href={openUrl || ""}
      openLabel="Open in Zoho Recruit"
    >
      {data.department && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Department:</span>{" "}
          {data.department}
        </DetailRow>
      )}
      {data.positions && (
        <DetailRow icon={<Users className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Positions:</span>{" "}
          {data.positions}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoRecruitInterviewDetailView({
  data,
  openUrl,
}: {
  data: ZohoRecruitInterviewData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho Recruit · Interview"
      title={data.interviewName || "Interview"}
      pills={<StatusPill value={data.status} />}
      href={openUrl || ""}
      openLabel="Open in Zoho Recruit"
    >
      {data.candidateName && (
        <DetailRow icon={<User className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Candidate:</span>{" "}
          {data.candidateName}
        </DetailRow>
      )}
      {data.jobOpeningName && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Job opening:</span>{" "}
          {data.jobOpeningName}
        </DetailRow>
      )}
      {data.interviewDate && (
        <DetailRow icon={<Calendar className="w-4 h-4" />}>
          {data.interviewDate}
          {data.from || data.to ? ` · ${data.from || "?"} – ${data.to || "?"}` : ""}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoCrmDealDetailView({
  data,
  openUrl,
}: {
  data: ZohoCrmDealData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho CRM · Deal"
      title={data.name || "Deal"}
      pills={<StatusPill value={data.stage} />}
      href={openUrl || ""}
      openLabel="Open in Zoho CRM"
    >
      {data.amount && (
        <DetailRow icon={<BarChart3 className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Amount:</span> {data.amount}
        </DetailRow>
      )}
      {data.account && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Account:</span>{" "}
          {data.account}
        </DetailRow>
      )}
      {data.closingDate && (
        <DetailRow icon={<CalendarClock className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Closing:</span>{" "}
          {data.closingDate}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoCrmLeadDetailView({
  data,
  openUrl,
}: {
  data: ZohoCrmLeadData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho CRM · Lead"
      title={data.name || "Lead"}
      pills={<StatusPill value={data.leadStatus} />}
      href={openUrl || ""}
      openLabel="Open in Zoho CRM"
    >
      {data.company && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Company:</span>{" "}
          {data.company}
        </DetailRow>
      )}
      {data.email && (
        <DetailRow icon={<Mail className="w-4 h-4" />}>{data.email}</DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoCrmTaskDetailView({
  data,
  openUrl,
}: {
  data: ZohoCrmTaskData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho CRM · Task"
      title={data.subject || "Task"}
      pills={
        <>
          <StatusPill value={data.status} />
          {data.priority && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              <Flag className="w-3 h-3" />
              {data.priority}
            </span>
          )}
        </>
      }
      href={openUrl || ""}
      openLabel="Open in Zoho CRM"
    >
      {data.relatedTo && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Related to:</span>{" "}
          {data.relatedTo}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoContractDetailView({
  data,
  openUrl,
}: {
  data: ZohoContractData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho Contracts · Contract"
      title={data.contractName || "Contract"}
      pills={<StatusPill value={data.contractStatus} />}
      href={openUrl || ""}
      openLabel="Open in Zoho Contracts"
    >
      {data.contractType && (
        <DetailRow icon={<Tag className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Type:</span>{" "}
          {data.contractType}
        </DetailRow>
      )}
      {data.company && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Company:</span>{" "}
          {data.company}
        </DetailRow>
      )}
      {(data.startDate || data.endDate) && (
        <DetailRow icon={<CalendarClock className="w-4 h-4" />}>
          {data.startDate || "?"} – {data.endDate || "?"}
        </DetailRow>
      )}
      {data.contractValue && (
        <DetailRow icon={<BarChart3 className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Value:</span>{" "}
          {data.contractValue}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoPeopleLeaveDetailView({
  data,
  openUrl,
}: {
  data: ZohoPeopleLeaveData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho People · Leave"
      title={data.employee || "Leave"}
      pills={<StatusPill value={data.leaveType} />}
      href={openUrl || ""}
      openLabel="Open in Zoho People"
    >
      {(data.from || data.to) && (
        <DetailRow icon={<CalendarClock className="w-4 h-4" />}>
          {data.from || "?"} – {data.to || "?"}
        </DetailRow>
      )}
      {data.dayCount && (
        <DetailRow icon={<BarChart3 className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Days:</span>{" "}
          {data.dayCount}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}

function ZohoPeopleJoinerDetailView({
  data,
  openUrl,
}: {
  data: ZohoPeopleJoinerData;
  openUrl?: string | null;
}) {
  return (
    <ZohoDetailShell
      source="Zoho People · New Joiner"
      title={data.name || "New Joiner"}
      href={openUrl || ""}
      openLabel="Open in Zoho People"
    >
      {data.designation && (
        <DetailRow icon={<BarChart3 className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Designation:</span>{" "}
          {data.designation}
        </DetailRow>
      )}
      {data.department && (
        <DetailRow icon={<FolderOpen className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Department:</span>{" "}
          {data.department}
        </DetailRow>
      )}
      {data.dateOfJoining && (
        <DetailRow icon={<Calendar className="w-4 h-4" />}>
          <span className="font-medium text-foreground">Joined:</span>{" "}
          {data.dateOfJoining}
        </DetailRow>
      )}
    </ZohoDetailShell>
  );
}
