"use client";

import { ContentIdea, ContentPlan } from "@/lib/types";
import { tr } from "@/lib/tr";

type TemplateInfo = {
  id: number;
  title: string;
  templateType: string;
  widgetCount: number;
  hasLorem: boolean;
};

export function BlogWriterStep2({
  plans,
  ideas,
  templates,
  onUpdatePlan,
  onBack,
  onNext,
}: {
  plans: ContentPlan[];
  ideas: ContentIdea[];
  templates: TemplateInfo[];
  onUpdatePlan: (ideaId: string, updates: Partial<ContentPlan>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {plans.map((plan) => {
          const idea = ideas.find((i) => i.id === plan.ideaId);
          if (!idea) return null;

          return (
            <div
              key={plan.ideaId}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
            >
              {/* Idea summary */}
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {idea.title}
                </h3>
                <p className="mt-1 text-xs text-gray-500">{idea.description}</p>
              </div>

              {/* Page title */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {tr.blogWriter.step2.pageTitle}
                </label>
                <input
                  type="text"
                  value={plan.title}
                  onChange={(e) =>
                    onUpdatePlan(plan.ideaId, { title: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Brief */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {tr.blogWriter.step2.contentBrief}
                </label>
                <textarea
                  value={plan.brief}
                  onChange={(e) =>
                    onUpdatePlan(plan.ideaId, { brief: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Template picker */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">
                  {tr.blogWriter.step2.elementorTemplate}
                </label>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {templates.map((t) => {
                    const isSelected = plan.templateId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() =>
                          onUpdatePlan(plan.ideaId, {
                            templateId: t.id,
                            templateName: t.title,
                          })
                        }
                        className={`rounded-lg border-2 p-3 text-left transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30"
                            : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                        }`}
                      >
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                          {t.title}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {tr.blogWriter.step2.widgets(t.widgetCount)}
                        </p>
                        {t.hasLorem && (
                          <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {tr.blogWriter.step2.hasPlaceholder}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-800">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {tr.common.back}
        </button>
        <button
          onClick={onNext}
          disabled={plans.some((p) => !p.templateId)}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {tr.blogWriter.step2.nextCreatePages}
        </button>
      </div>
    </div>
  );
}
