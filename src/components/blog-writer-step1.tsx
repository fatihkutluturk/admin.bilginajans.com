"use client";

import { useState, FormEvent } from "react";
import { ContentIdea } from "@/lib/types";
import { tr } from "@/lib/tr";

export function BlogWriterStep1({
  ideas,
  selectedIds,
  loading,
  error,
  onResearch,
  onToggleIdea,
  onNext,
}: {
  ideas: ContentIdea[];
  selectedIds: Set<string>;
  loading: boolean;
  error: string;
  onResearch: (customTopic: string) => void;
  onToggleIdea: (id: string) => void;
  onNext: () => void;
}) {
  const [topic, setTopic] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onResearch(topic);
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "blog": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "service": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "landing": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "faq": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "about": return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const typeLabel = (type: string) =>
    tr.blogWriter.contentTypes[type as keyof typeof tr.blogWriter.contentTypes] || type;

  const volumeColor = (hint: string) => {
    if (hint.includes("Yüksek")) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (hint.includes("Orta")) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={tr.blogWriter.step1.topicPlaceholder}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? tr.blogWriter.step1.researching : tr.blogWriter.step1.generateIdeas}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {tr.blogWriter.step1.description}
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            <p className="mt-3 text-sm text-gray-500">{tr.blogWriter.step1.analyzing}</p>
          </div>
        )}

        {!loading && ideas.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">{tr.blogWriter.step1.emptyState}</p>
          </div>
        )}

        {!loading && ideas.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ideas.map((idea) => {
              const isSelected = selectedIds.has(idea.id);
              return (
                <button
                  key={idea.id}
                  onClick={() => onToggleIdea(idea.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 shadow-md dark:border-indigo-400 dark:bg-indigo-950/30"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {idea.title}
                    </h3>
                    <div
                      className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${
                        isSelected ? "border-indigo-500 bg-indigo-500" : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-full w-full text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${typeColor(idea.contentType)}`}>
                      {typeLabel(idea.contentType)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {idea.targetKeyword}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${volumeColor(idea.searchVolumeHint)}`}>
                      {idea.searchVolumeHint}
                    </span>
                  </div>

                  <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                    {idea.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      {idea.alignment}
                    </p>
                    <span className="text-xs text-gray-400">
                      Template: {idea.suggestedTemplateType}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {ideas.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedIds.size} {tr.common.selected}
          </p>
          <button
            onClick={onNext}
            disabled={selectedIds.size === 0}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {tr.blogWriter.step1.nextPickTemplates}
          </button>
        </div>
      )}
    </div>
  );
}
