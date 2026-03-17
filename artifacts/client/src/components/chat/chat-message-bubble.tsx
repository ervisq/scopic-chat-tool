import { motion } from "framer-motion";
import { format } from "date-fns";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
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
            {isUser ? highlightToolMentions(message.text) : message.text}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
