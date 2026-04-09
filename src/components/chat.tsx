"use client";

import { useRef, useEffect, useState, FormEvent } from "react";
import { useChat } from "@/hooks/use-chat";
import { tr } from "@/lib/tr";
import { MessageBubble } from "./message-bubble";
import { ConfirmationCard } from "./confirmation-card";

export function Chat() {
  const {
    messages,
    isLoading,
    pendingAction,
    sendMessage,
    approveAction,
    rejectAction,
  } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pendingAction]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading || pendingAction) return;
    setInput("");
    sendMessage(text);
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr.chat.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr.chat.subtitle}
        </p>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-400 dark:text-gray-500">
                {tr.chat.emptyTitle}
              </p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-600">
                {tr.chat.emptyHint}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {pendingAction && (
          <ConfirmationCard
            action={pendingAction}
            onApprove={approveAction}
            onReject={rejectAction}
            isLoading={isLoading}
          />
        )}

        {isLoading && !pendingAction && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
              <div className="flex space-x-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 px-6 py-4 dark:border-gray-800"
      >
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingAction
                ? tr.chat.pendingPlaceholder
                : tr.chat.inputPlaceholder
            }
            disabled={isLoading || !!pendingAction}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={isLoading || !!pendingAction || !input.trim()}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {tr.common.send}
          </button>
        </div>
      </form>
    </div>
  );
}
