import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { EmptyState } from "@/components/chat/empty-state";
import { motion } from "framer-motion";

export default function ChatPage() {
  const { messages, sendMessage, isTyping } = useChat();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages or typing status changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;
    
    sendMessage(inputValue.trim());
    setInputValue("");
  };

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-xl border-b border-border/40 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold tracking-tight text-foreground leading-none">
              AI Assistant
            </h1>
            <p className="text-[11px] font-medium text-primary uppercase tracking-wider mt-0.5">
              Ready to help
            </p>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto w-full relative scroll-smooth">
        <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col p-4 md:p-6 pb-8 pt-8">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState />
            </div>
          ) : (
            <div className="flex flex-col flex-1 pb-4">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={bottomRef} className="h-1" />
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="shrink-0 bg-gradient-to-t from-background via-background to-transparent pb-6 pt-4 px-4 md:px-6 z-10">
        <div className="max-w-4xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-card rounded-2xl md:rounded-[24px] border border-border/60 shadow-lg shadow-black/5 p-2 focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary/40 transition-all duration-300"
          >
            <input
              id="chat-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message the assistant..."
              className="w-full bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground text-[15px] md:text-base px-4 py-3 md:py-4 h-full"
              autoComplete="off"
            />
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="h-10 w-10 md:h-12 md:w-12 shrink-0 rounded-xl md:rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-primary/90"
              aria-label="Send message"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5 ml-0.5" />
            </motion.button>
          </form>
          <div className="text-center mt-3">
            <p className="text-xs text-muted-foreground/60 font-medium">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
