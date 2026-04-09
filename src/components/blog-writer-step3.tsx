"use client";

import { useState } from "react";
import { ContentPlan } from "@/lib/types";
import { tr } from "@/lib/tr";
import { Check } from "lucide-react";
import useSWR from "swr";
import { ElementorEditor } from "./elementor-editor";

export function BlogWriterStep3({
  plans,
  createdPages,
  loading,
  error,
  onCreatePage,
  onBack,
}: {
  plans: ContentPlan[];
  createdPages: Record<string, number>;
  loading: boolean;
  error: string;
  onCreatePage: (ideaId: string) => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<string>(plans[0]?.ideaId || "");
  const { data: siteData } = useSWR("/api/site", (url: string) => fetch(url).then(r => r.json()), { revalidateOnFocus: false, dedupingInterval: 300000 });
  const wpUrl = siteData?.wpUrl || "";

  const activePlan = plans.find((p) => p.ideaId === activeTab);
  const activePageId = activeTab ? createdPages[activeTab] : undefined;

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tabs for multiple pages */}
      {plans.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200 px-6 pt-3 dark:border-gray-800">
          {plans.map((plan) => {
            const isCreated = !!createdPages[plan.ideaId];
            return (
              <button
                key={plan.ideaId}
                onClick={() => setActiveTab(plan.ideaId)}
                className={`rounded-t-lg px-4 py-2 text-xs font-medium transition-colors ${
                  activeTab === plan.ideaId
                    ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {plan.title.slice(0, 30)}
                {plan.title.length > 30 ? "..." : ""}
                {isCreated && (
                  <Check className="ml-1 inline h-3.5 w-3.5 text-green-600" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active page content */}
      {activePlan && (
        <div className="flex-1 overflow-hidden">
          {!activePageId ? (
            /* Not created yet — show create button */
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {activePlan.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Template: {activePlan.templateName}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Keyword: {activePlan.primaryKeyword}
                </p>
                <p className="mt-2 text-xs text-gray-500 max-w-md">
                  {activePlan.brief}
                </p>
              </div>
              <button
                onClick={() => onCreatePage(activePlan.ideaId)}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? tr.blogWriter.step3.creatingPage : tr.blogWriter.step3.createFromTemplate}
              </button>
              <p className="text-xs text-gray-400">
                {tr.blogWriter.step3.createDescription}
              </p>
            </div>
          ) : (
            /* Page created — show Elementor editor with brief pre-filled */
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-2 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {tr.blogWriter.step3.pageCreated(activePageId)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {tr.blogWriter.step3.fillInstruction}
                  </span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`${wpUrl}/wp-admin/post.php?post=${activePageId}&action=elementor`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                  >
                    {tr.blogWriter.step3.openInElementor}
                  </a>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <ElementorEditorWithBrief
                  pageId={activePageId}
                  brief={activePlan.brief}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-800">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {tr.common.back}
        </button>
        <p className="text-xs text-gray-500">
          {tr.blogWriter.step3.pagesCreated(Object.keys(createdPages).length, plans.length)}
        </p>
      </div>
    </div>
  );
}

/**
 * Wrapper around ElementorEditor that pre-fills the brief field.
 * The ElementorEditor has its own brief input — we want to set it automatically.
 */
function ElementorEditorWithBrief({
  pageId,
  brief,
}: {
  pageId: number;
  brief: string;
}) {
  return <ElementorEditor pageId={pageId} type="pages" initialBrief={brief} />;
}
