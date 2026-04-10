import { motion } from "framer-motion";
import { format } from "date-fns";
import { User, Bot } from "lucide-react";
import { cn, isSafeExternalUrl } from "@/lib/utils";
import { ToolBadge } from "@/components/chat/tool-badge";
import { getToolConfig } from "@/lib/tool-config";
import type { Message } from "@/hooks/use-chat";

interface ChatMessageBubbleProps {
  message: Message;
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

function linkifyText(text: string): (string | JSX.Element)[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const url = match[1];
    if (isSafeExternalUrl(url)) {
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

  return parts;
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

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.sender === "user";

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
            {isUser ? highlightToolMentions(message.text) : linkifyText(message.text)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
