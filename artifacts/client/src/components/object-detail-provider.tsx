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
} from "lucide-react";

export type DetailTarget =
  | {
      type: "teamwork_task";
      id: number;
      openUrl?: string | null;
      label?: string;
    }
  | {
      type: "outlook_email";
      id: string;
      openUrl?: string | null;
      label?: string;
      unread?: boolean;
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
                />
              </div>
            </div>
          ) : (
            <DetailBody target={activeTarget} token={token} />
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
  return (
    <div className="shrink-0 sm:w-64 flex flex-col border-b sm:border-b-0 sm:border-r border-border bg-muted/20 overflow-hidden max-h-44 sm:max-h-none">
      <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
        Items ({targets.length})
      </p>
      <ul className="overflow-y-auto flex-1 px-2 pb-2 space-y-0.5">
        {targets.map((t, i) => {
          const active = i === activeIndex;
          const isEmail = t.type === "outlook_email";
          const label = t.label || (isEmail ? "(No Subject)" : `#${t.id}`);
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
                  ) : (
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      #{t.id}
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
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DetailBody({
  target,
  token,
}: {
  target: DetailTarget;
  token: string | null | undefined;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamwork, setTeamwork] = useState<TeamworkTaskDetail | null>(null);
  const [email, setEmail] = useState<MailDetail | null>(null);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setTeamwork(null);
      setEmail(null);
      try {
        const url =
          target.type === "teamwork_task"
            ? `${baseUrl}/api/details/teamwork/task/${target.id}`
            : `${baseUrl}/api/details/outlook/email?id=${encodeURIComponent(target.id)}`;
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
        } else {
          setEmail(data as MailDetail);
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
  }, [target, token, baseUrl]);

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
      <DialogHeader>
        <DialogTitle className="pr-8 break-words">{task.name}</DialogTitle>
        <p className="text-xs font-mono text-muted-foreground">#{task.id}</p>
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
        <div className="pt-2 border-t border-border">
          <OpenInButton href={href} label="Open in Teamwork" />
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
      <DialogHeader>
        <DialogTitle className="pr-8 break-words">
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
        <div className="pt-2 border-t border-border">
          <OpenInButton href={href} label="Open in Outlook" />
        </div>
      )}
    </>
  );
}
