import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, LogOut } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { EmptyState } from "@/components/chat/empty-state";

interface ChatPageProps {
  user: { email: string; name: string } | null;
  onLogout: () => void;
}

export default function ChatPage({ user, onLogout }: ChatPageProps) {
  const { messages, sendMessage, isTyping } = useChat();
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isTyping) return;
    sendMessage(trimmed);
    setInputValue("");
    textareaRef.current?.focus();
  }, [inputValue, isTyping, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-background z-10">
        <h1 className="text-base font-semibold text-foreground">Chat</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center min-h-full">
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/50 bg-background px-4 md:px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-card border border-border/60 rounded-2xl p-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              aria-label="Message"
              rows={1}
              className="w-full bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground text-[15px] px-3 py-2 resize-none max-h-[200px] leading-normal"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground/50 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
