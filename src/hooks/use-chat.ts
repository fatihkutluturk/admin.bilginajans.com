"use client";

import { useState, useCallback } from "react";
import { Message, PendingAction, StreamChunk, ChatRequest } from "@/lib/types";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );

  const processStream = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk: StreamChunk = JSON.parse(line);

            switch (chunk.type) {
              case "text":
              case "result":
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: chunk.content },
                ]);
                break;
              case "confirmation":
                setPendingAction(chunk.pendingAction);
                break;
              case "error":
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: `Error: ${chunk.content}` },
                ]);
                break;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const userMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const body: ChatRequest = {
          messages: [...messages, userMessage],
        };

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        await processStream(response);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, processStream]
  );

  const approveAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    const action = pendingAction;
    setPendingAction(null);

    // Add confirmation message to chat
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: `Pending: ${action.summary}` },
      { role: "user", content: "Approved" },
    ]);

    try {
      const body: ChatRequest = {
        messages: [
          ...messages,
          { role: "assistant", content: action.summary },
          { role: "user", content: "Approved" },
        ],
        pendingAction: { ...action, approved: true },
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await processStream(response);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, pendingAction, processStream]);

  const rejectAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    const action = pendingAction;
    setPendingAction(null);

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: `Pending: ${action.summary}` },
      { role: "user", content: "Rejected" },
    ]);

    try {
      const body: ChatRequest = {
        messages: [
          ...messages,
          { role: "assistant", content: action.summary },
          { role: "user", content: "Rejected" },
        ],
        pendingAction: { ...action, approved: false },
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await processStream(response);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, pendingAction, processStream]);

  return {
    messages,
    isLoading,
    pendingAction,
    sendMessage,
    approveAction,
    rejectAction,
  };
}
