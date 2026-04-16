import { motion } from "framer-motion";
import { MessageSquare, Sparkles, MousePointerClick } from "lucide-react";

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center px-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <MessageSquare className="w-7 h-7 text-primary" />
      </div>

      <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">
        How can I help you today?
      </h2>

      <p className="text-muted-foreground text-sm mb-6 max-w-md">
        Pick a tool below, tap a quick query, or just type your own message.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 text-xs text-muted-foreground/80">
        <div className="inline-flex items-center gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5" />
          <span>Click a tool pill below</span>
        </div>
        <div className="hidden sm:block">·</div>
        <div className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Or type @ to mention a tool</span>
        </div>
      </div>
    </motion.div>
  );
}
