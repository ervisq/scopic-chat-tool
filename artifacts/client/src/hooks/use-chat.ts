import { useState, useCallback } from "react";
import { useSendMessage } from "@workspace/api-client-react";

export type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  toolName?: string;
};

function parseToolFromMessage(message: string): string | undefined {
  const match = message.trim().match(/^@([a-zA-Z0-9_-]+)\s+/);
  return match ? match[1] : undefined;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const sendMessageMutation = useSendMessage();

  const sendMessage = useCallback(
    (text: string) => {
      const toolName = parseToolFromMessage(text);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        text,
        sender: "user",
        timestamp: new Date(),
        toolName,
      };

      setMessages((prev) => [...prev, userMessage]);

      sendMessageMutation.mutate(
        {
          data: { message: text },
        },
        {
          onSuccess: (response) => {
            const botToolName =
              (response as any).toolCommand?.tool || toolName;
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
