"use client";

import { useState, useEffect, useCallback } from "react";
import { PageAudit } from "@/lib/types";
import { tr } from "@/lib/tr";

type AuditData = {
  pages: PageAudit[];
  siteScore: number;
  totalPages: number;
  pagesWithIssues: number;
};

type Filter = "all" | "errors" | "warnings" | "good";

export function ContentAudit({ onEditPage }: { onEditPage: (id: number) => void }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const runAudit = useCallback(async (deep = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deep }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runAudit(false); // fast scan on load
  }, [runAudit]);

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const scoreBg = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 50) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  const issueColor = (type: string) => {
    switch (type) {
      case "error": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "warning": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default: return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  const filteredPages = data?.pages.filter((p) => {
    switch (filter) {
      case "errors": return p.issues.some((i) => i.type === "error");
      case "warnings": return p.issues.some((i) => i.type === "warning") && !p.issues.some((i) => i.type === "error");
      case "good": return p.issues.length === 0 || p.score >= 80;
      default: return true;
    }
  }) || [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              {tr.audit.title}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {tr.audit.subtitle}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runAudit(false)}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? tr.audit.scanning : tr.audit.rescan}
            </button>
            <button
              onClick={() => runAudit(true)}
              disabled={loading}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors dark:border-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
            >
              {loading ? tr.audit.scanning : tr.audit.deepScan}
            </button>
          </div>
        </div>

        {/* Stats row */}
        {data && !loading && (
          <div className="mt-5 grid grid-cols-4 gap-3">
            <div className={`rounded-xl border p-4 ${scoreBg(data.siteScore)} border-transparent`}>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr.audit.siteScore}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${scoreColor(data.siteScore)}`}>
                {data.siteScore}<span className="text-sm font-normal text-gray-400">/100</span>
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr.audit.totalPages}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {data.totalPages}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr.audit.pagesWithIssues}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {data.pagesWithIssues}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr.audit.avgScore}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${scoreColor(data.siteScore)}`}>
                {data.siteScore}
              </p>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {data && !loading && (
          <div className="mt-3 flex gap-2">
            {(["all", "errors", "warnings", "good"] as Filter[]).map((f) => {
              const labels: Record<Filter, string> = {
                all: tr.audit.filterAll,
                errors: tr.audit.filterErrors,
                warnings: tr.audit.filterWarnings,
                good: tr.audit.filterGood,
              };
              const count = f === "all"
                ? data.pages.length
                : f === "errors"
                  ? data.pages.filter((p) => p.issues.some((i) => i.type === "error")).length
                  : f === "warnings"
                    ? data.pages.filter((p) => p.issues.some((i) => i.type === "warning") && !p.issues.some((i) => i.type === "error")).length
                    : data.pages.filter((p) => p.issues.length === 0 || p.score >= 80).length;

              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                    filter === f
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800"
                  }`}
                >
                  {labels[f]} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          <p className="mt-3 text-sm text-gray-500">{tr.audit.scanning}</p>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Page list */}
      {!loading && data && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {filteredPages.map((page) => (
            <div
              key={page.id}
              className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              {/* Score circle */}
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${scoreBg(page.score)} ${scoreColor(page.score)}`}
              >
                {page.score}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {page.title || "(Başlık yok)"}
                  </h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    page.status === "publish"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    {tr.status[page.status as keyof typeof tr.status] || page.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  /{page.slug} — {page.wordCount} {tr.audit.wordCount}
                  {page.hasElementor && " — Elementor"}
                </p>

                {/* Issues */}
                {page.issues.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {page.issues.map((issue, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-2 py-0.5 text-xs ${issueColor(issue.type)}`}
                      >
                        {issue.message}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action */}
              <button
                onClick={() => onEditPage(page.id)}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                {tr.common.edit}
              </button>
            </div>
          ))}

          {filteredPages.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              {tr.common.noResults}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
