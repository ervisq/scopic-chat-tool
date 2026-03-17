import { motion } from "framer-motion";
import { format } from "date-fns";
import { User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/use-chat";

interface ChatMessageBubbleProps {
  message: Message;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.sender === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
      className={cn(
        "flex w-full gap-3 mb-6",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 text-primary flex items-center justify-center shrink-0 border border-primary/10 shadow-sm mt-auto">
          <Sparkles className="w-4 h-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] md:max-w-[70%] flex flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "px-5 py-3.5 shadow-sm relative group",
            isUser 
              ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl rounded-br-sm shadow-primary/20" 
              : "bg-card border border-border/50 text-card-foreground rounded-2xl rounded-bl-sm shadow-black/5"
          )}
        >
          <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
            {message.text}
          </p>
        </div>
        
        <span className="text-[11px] font-medium text-muted-foreground/70 px-1 uppercase tracking-wider">
          {format(message.timestamp, "h:mm a")}
        </span>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-foreground/5 to-foreground/10 text-foreground/70 flex items-center justify-center shrink-0 border border-border/50 shadow-sm mt-auto">
          <User className="w-4 h-4" />
        </div>
      )}
    </motion.div>
  );
}
