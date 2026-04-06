import { useState, useCallback, useRef } from "react";
import { useSendMessage } from "@workspace/api-client-react";

export type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  toolName?: string;
};

const MAX_HISTORY = 20;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const sendMessageMutation = useSendMessage();

  messagesRef.current = messages;

  const sendMessage = useCallback(
    (text: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        text,
        sender: "user",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      const history = messagesRef.current
        .slice(-MAX_HISTORY)
        .map((m) => ({
          role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        }));

      sendMessageMutation.mutate(
        {
          data: { message: text, history },
        },
        {
          onSuccess: (response) => {
            const botToolName = response.toolCommand?.tool;
            const botMessage: Message = {
              id: crypto.randomUUID(),
              text: response.reply,
              sender: "bot",
              timestamp: response.timestamp
                ? new Date(response.timestamp)
                : new Date(),
              toolName: botToolName,
            };
            setMessages((prev) => [...prev, botMessage]);

            if (botToolName) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === userMessage.id ? { ...m, toolName: botToolName } : m,
                ),
              );
            }
          },
          onError: (error) => {
            console.error("Failed to send message:", error);
            const errorMessage: Message = {
              id: crypto.randomUUID(),
              text: "Sorry, I encountered an error trying to process that message.",
              sender: "bot",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          },
        },
      );
    },
    [sendMessageMutation],
  );

  return {
    messages,
    sendMessage,
    isTyping: sendMessageMutation.isPending,
  };
}
