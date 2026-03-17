import { motion } from "framer-motion";
import { MessageSquare, TicketCheck, Users, Shield } from "lucide-react";

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

const suggestions = [
  { icon: MessageSquare, text: "What can you help me with today?" },
  { icon: TicketCheck, text: "@JIRA show my open tickets" },
  { icon: Users, text: "@Zoho list recent contacts" },
  { icon: Shield, text: "@STS show compliance status" },
];

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center px-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <MessageSquare className="w-7 h-7 text-primary" />
      </div>

      <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">
        How can I help you today?
      </h2>

      <p className="text-muted-foreground text-sm mb-8 max-w-md">
        Send a message or use @ commands to query your tools.
      </p>

      <div className="w-full grid gap-2.5 sm:grid-cols-2">
        {suggestions.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.3 }}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/50 hover:border-border cursor-pointer transition-all text-left group"
            >
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm text-foreground/80 leading-snug">
                {suggestion.text}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
