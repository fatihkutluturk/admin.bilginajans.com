"use client";

import { useState, FormEvent } from "react";
import { tr } from "@/lib/tr";

export function CloneDialog({
  sourcePageId,
  sourcePageTitle,
  onClose,
  onCloned,
}: {
  sourcePageId: number;
  sourcePageTitle: string;
  onClose: () => void;
  onCloned: (newPageId: number) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !brief.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pages/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePageId, newTitle: newTitle.trim(), brief: brief.trim(), language: "tr" }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || `HTTP ${res.status}`); }
      const data = await res.json();
      onCloned(data.pageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tr.clone.title}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tr.clone.usingTemplate(sourcePageTitle)}</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr.clone.newPageTitle}</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="ör. USB Bellek Baski"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr.clone.contentBrief}</label>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder={tr.clone.briefPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
              {tr.common.cancel}
            </button>
            <button type="submit" disabled={loading || !newTitle.trim() || !brief.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? tr.clone.creating : tr.clone.cloneAndGenerate}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
