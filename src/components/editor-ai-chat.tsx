"use client";

import { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { Message, StreamChunk, ChatRequest } from "@/lib/types";
import { tr } from "@/lib/tr";
import { MessageSquare, X } from "lucide-react";

type ContentFields = {
  title: string;
  content: string;
  excerpt: string;
};

export function EditorAIChat({
  pageId,
  pageType,
  fields,
  onApplyFields,
}: {
  pageId: number;
  pageType: "pages" | "posts";
  fields: ContentFields;
  onApplyFields: (fields: Partial<ContentFields>) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      // Inject current content context into the message
      const contextMessage = `[CONTEXT: You are editing a WordPress ${pageType === "pages" ? "page" : "post"} (ID: ${pageId}). Current title: "${fields.title}". Current excerpt: "${fields.excerpt}". Current content length: ${fields.content.length} chars.

When the user asks you to change content, respond with the updated text wrapped in special tags so it can be applied automatically:
- For title changes: <APPLY_TITLE>new title here</APPLY_TITLE>
- For content changes: <APPLY_CONTENT>new html content here</APPLY_CONTENT>
- For excerpt changes: <APPLY_EXCERPT>new excerpt here</APPLY_EXCERPT>

You can include multiple tags in one response. Always include the tags when making changes — the user sees both your explanation and the applied changes.

Current content:
${fields.content.slice(0, 3000)}${fields.content.length > 3000 ? "\n...(truncated)" : ""}]

User request: ${text}`;

      const userMessage: Message = { role: "user", content: text };
      const allMessages = [...messages, userMessage];
      setMessages(allMessages);
      setIsLoading(true);

      try {
        const body: ChatRequest = {
          messages: allMessages.map((m, i) => {
            // Only inject context into the latest user message
            if (i === allMessages.length - 1 && m.role === "user") {
              return { role: "user", content: contextMessage };
            }
            return m;
          }),
        };

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
              if (chunk.type === "text" || chunk.type === "result") {
                // Parse apply tags and update fields
                const applied = parseApplyTags(chunk.content);
                if (applied) {
                  onApplyFields(applied);
                }

                // Clean display text (remove tags)
                const displayText = chunk.content
                  .replace(/<APPLY_TITLE>[\s\S]*?<\/APPLY_TITLE>/g, "")
                  .replace(/<APPLY_CONTENT>[\s\S]*?<\/APPLY_CONTENT>/g, "")
                  .replace(/<APPLY_EXCERPT>[\s\S]*?<\/APPLY_EXCERPT>/g, "")
                  .trim();

                const appliedLabel = applied
                  ? "\n\n✅ Changes applied to the editor."
                  : "";

                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: (displayText || "Done.") + appliedLabel,
                  },
                ]);
              } else if (chunk.type === "error") {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: `Error: ${chunk.content}` },
                ]);
              }
            } catch {
              // skip
            }
          }
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, fields, pageId, pageType, onApplyFields]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"
        title={tr.aiAssistant.title}
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr.aiAssistant.title}
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Collapse"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="space-y-1 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr.aiAssistant.quickActions}
          </p>
          {tr.aiAssistant.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => sendMessage(suggestion)}
              disabled={isLoading}
              className="block w-full rounded-md border border-gray-200 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-white disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${msg.role === "user" ? "ml-8 text-right" : "mr-8"}`}
          >
            <div
              className={`inline-block rounded-xl px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans">
                {msg.content}
              </pre>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="mr-8">
            <div className="inline-block rounded-xl bg-white px-3 py-2 dark:bg-gray-800">
              <div className="flex space-x-1">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 px-4 py-3 dark:border-gray-800"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tr.aiAssistant.inputPlaceholder}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {tr.common.send}
          </button>
        </div>
      </form>
    </div>
  );
}

function parseApplyTags(text: string): Partial<ContentFields> | null {
  const result: Partial<ContentFields> = {};
  let found = false;

  const titleMatch = text.match(/<APPLY_TITLE>([\s\S]*?)<\/APPLY_TITLE>/);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
    found = true;
  }

  const contentMatch = text.match(
    /<APPLY_CONTENT>([\s\S]*?)<\/APPLY_CONTENT>/
  );
  if (contentMatch) {
    result.content = contentMatch[1].trim();
    found = true;
  }

  const excerptMatch = text.match(
    /<APPLY_EXCERPT>([\s\S]*?)<\/APPLY_EXCERPT>/
  );
  if (excerptMatch) {
    result.excerpt = excerptMatch[1].trim();
    found = true;
  }

  return found ? result : null;
}
