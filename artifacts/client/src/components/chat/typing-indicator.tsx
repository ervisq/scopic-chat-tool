import { motion } from "framer-motion";
import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full py-5 px-4 md:px-0 bg-muted/30"
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        <div className="w-8 h-8 rounded-lg bg-foreground/10 text-foreground/70 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">Assistant</span>
          </div>
          <div className="flex items-center gap-1.5 h-6" role="status" aria-live="polite" aria-label="Assistant is typing">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-muted-foreground/50"
                animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
