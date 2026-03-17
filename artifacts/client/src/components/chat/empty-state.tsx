import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Zap } from "lucide-react";

export function EmptyState() {
  const suggestions = [
    "What can you help me with today?",
    "Explain quantum computing in simple terms.",
    "Help me write a professional email.",
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center px-4"
    >
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6 shadow-sm border border-primary/10">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      
      <h2 className="text-2xl md:text-3xl font-bold font-display text-foreground tracking-tight mb-3">
        How can I help you today?
      </h2>
      
      <p className="text-muted-foreground text-base mb-8 max-w-md">
        I'm your intelligent assistant, ready to help you brainstorm, write, or answer any questions you might have.
      </p>

      <div className="w-full grid gap-3">
        {suggestions.map((suggestion, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + (i * 0.1), duration: 0.4 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/60 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer transition-all duration-300 group text-left"
            onClick={() => {
              const input = document.getElementById("chat-input") as HTMLInputElement;
              if (input) {
                input.value = suggestion;
                input.focus();
              }
            }}
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
              {i % 2 === 0 ? <MessageSquare className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </div>
            <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
              {suggestion}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
