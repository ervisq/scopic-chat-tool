import { useState, useCallback } from "react";
import { useSendMessage } from "@workspace/api-client-react";

export type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
};

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const sendMessageMutation = useSendMessage();

  const sendMessage = useCallback(
    (text: string) => {
      // 1. Instantly append the user's message to local state
      const userMessage: Message = {
        id: crypto.randomUUID(),
        text,
        sender: "user",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, userMessage]);

      // 2. Call the generated API mutation
      sendMessageMutation.mutate(
        {
          data: { message: text },
        },
        {
          onSuccess: (response) => {
            // 3. Append the bot's reply when successful
            const botMessage: Message = {
              id: crypto.randomUUID(),
              text: response.reply,
              sender: "bot",
              timestamp: response.timestamp ? new Date(response.timestamp) : new Date(),
            };
            setMessages((prev) => [...prev, botMessage]);
          },
          onError: (error) => {
            console.error("Failed to send message:", error);
            // Append a fallback error message so the user isn't left hanging
            const errorMessage: Message = {
              id: crypto.randomUUID(),
              text: "Sorry, I encountered an error trying to process that message.",
              sender: "bot",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          },
        }
      );
    },
    [sendMessageMutation]
  );

  return {
    messages,
    sendMessage,
    isTyping: sendMessageMutation.isPending,
  };
}
