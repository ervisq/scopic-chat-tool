import { motion } from "framer-motion";
import { format } from "date-fns";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/use-chat";

interface ChatMessageBubbleProps {
  message: Message;
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
        isUser ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/10 text-foreground/70"
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
            <span className="text-xs text-muted-foreground">
              {format(message.timestamp, "h:mm a")}
            </span>
          </div>
          <p className="text-[15px] leading-relaxed text-foreground/90 break-words whitespace-pre-wrap">
            {message.text}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
