import { useState, type ReactElement } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { User, Bot, Link2, Loader2 } from "lucide-react";
import { cn, isSafeExternalUrl } from "@/lib/utils";
import { useObjectDetail, type DetailTarget } from "@/components/object-detail-provider";
import { ToolBadge } from "@/components/chat/tool-badge";
import { getToolConfig } from "@/lib/tool-config";
import {
  detectReconnectProvider,
  getProviderConfig,
  startOAuthConnect,
  type ReconnectProviderKey,
} from "@/lib/connect-service";
import type { Message } from "@/hooks/use-chat";

interface ChatMessageBubbleProps {
  message: Message;
  token?: string | null;
}

const PROVIDER_STYLES: Record<
  ReconnectProviderKey,
  { label: string; btn: string; banner: string }
> = {
  teamwork: {
    label: "Teamwork",
    btn: "bg-purple-500 hover:bg-purple-600",
    banner:
      "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300",
  },
  jira: {
    label: "Jira",
    btn: "bg-blue-500 hover:bg-blue-600",
    banner:
      "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
  },
  zoho: {
    label: "Zoho",
    btn: "bg-amber-500 hover:bg-amber-600",
    banner:
      "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  },
};

function ReconnectBanner({
  provider,
  token,
}: {
  provider: ReconnectProviderKey;
  token: string | null | undefined;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = PROVIDER_STYLES[provider];

  async function handleReconnect() {
    setError(null);
    setLoading(true);
    const config = getProviderConfig(provider);
    if (!config) {
      setError("This service can't be reconnected from here.");
      setLoading(false);
      return;
    }
    const result = await startOAuthConnect(provider, token ?? null, "chat");
    if (!result.ok) {
      setError(result.message);
      setLoading(false);
    }
  }

  return (
    <div
      role="alert"
      data-testid={`reconnect-banner-${provider}`}
      className={cn(
        "mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border px-3 py-2.5 text-xs",
        styles.banner,
      )}
    >
      <p className="flex-1">
        Your {styles.label} connection needs to be re-authorized to keep using
        @{styles.label} commands.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleReconnect}
          disabled={loading || !token}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
            styles.btn,
          )}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
          Reconnect {styles.label}
        </button>
        {error && <span className="text-destructive text-[11px]">{error}</span>}
      </div>
    </div>
  );
}

function highlightToolMentions(text: string): (string | JSX.Element)[] {
  const regex = /@([a-zA-Z0-9_-]+)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const toolName = match[1];
    const config = getToolConfig(toolName);

    if (config) {
      parts.push(
        <span key={match.index} className={cn("font-semibold", config.textColor)}>
          @{toolName}
        </span>,
      );
    } else {
      parts.push(`@${toolName}`);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function detectDetailTarget(url: string): DetailTarget | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(".teamwork.com")) {
      const m = parsed.pathname.match(/\/app\/tasks\/(\d+)/);
      if (m) {
        return { type: "teamwork_task", id: Number(m[1]), openUrl: url };
      }
    }
    if (host === "outlook.office.com") {
      const m = parsed.pathname.match(/\/mail\/[^/]+\/id\/([^/?#]+)/);
      if (m) {
        let id = m[1];
        try {
          id = decodeURIComponent(id);
        } catch {
          // keep raw id if it is not percent-encoded
        }
        return { type: "outlook_email", id, openUrl: url };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function MessageText({ text }: { text: string }) {
  const { openDetail } = useObjectDetail();
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
  const parts: (string | ReactElement)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const url = match[1];
    const detailTarget = detectDetailTarget(url);
    if (detailTarget) {
      parts.push(
        <button
          key={match.index}
          type="button"
          onClick={() => openDetail(detailTarget)}
          className="text-blue-600 dark:text-blue-400 hover:underline break-all bg-transparent border-none p-0 cursor-pointer text-left"
        >
          {getUrlLabel(url)}
        </button>,
      );
    } else if (isSafeExternalUrl(url)) {
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
        >
          {getUrlLabel(url)}
        </a>,
      );
    } else {
      parts.push(url);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

const TRUSTED_HOSTS: Array<{ test: (host: string) => boolean; label: (url: URL) => string }> = [
  {
    test: (h) => h.endsWith(".atlassian.net"),
    label: (u) => {
      const m = u.pathname.match(/\/browse\/(.+)/);
      return m ? `Open ${m[1]}` : "Open in Jira";
    },
  },
  {
    test: (h) => h.endsWith(".teamwork.com"),
    label: (u) => {
      const m = u.pathname.match(/\/app\/tasks\/(\d+)/);
      if (m) return `Open #${m[1]}`;
      const p = u.pathname.match(/\/app\/projects\/(\d+)/);
      if (p) return `Open project`;
      return "Open in Teamwork";
    },
  },
  {
    test: (h) => h === "outlook.office.com",
    label: (u) => {
      if (u.pathname.includes("/mail/")) return "Open in Outlook";
      if (u.pathname.includes("/calendar/")) return "Open in Outlook";
      return "Open in Outlook";
    },
  },
];

function getUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    for (const entry of TRUSTED_HOSTS) {
      if (entry.test(host)) return entry.label(parsed);
    }
    return `Open link (${host})`;
  } catch {
    return "Open link";
  }
}

export function ChatMessageBubble({ message, token }: ChatMessageBubbleProps) {
  const isUser = message.sender === "user";
  const reconnectProvider = !isUser
    ? detectReconnectProvider(message.text, message.toolName)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "w-full py-5 px-4 md:px-0",
        isUser ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/10 text-foreground/70",
          )}
        >
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">
              {isUser ? "You" : "Assistant"}
            </span>
            {message.toolName && (
              <ToolBadge toolName={message.toolName} />
            )}
            <span className="text-xs text-muted-foreground">
              {format(message.timestamp, "h:mm a")}
            </span>
          </div>
          <p className="text-[15px] leading-relaxed text-foreground/90 break-words whitespace-pre-wrap">
            {isUser ? highlightToolMentions(message.text) : <MessageText text={message.text} />}
          </p>
          {reconnectProvider && (
            <ReconnectBanner provider={reconnectProvider} token={token} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
