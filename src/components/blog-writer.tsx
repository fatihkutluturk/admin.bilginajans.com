"use client";

import { useState, useCallback, useMemo } from "react";
import { ContentIdea, ContentPlan } from "@/lib/types";
import { tr } from "@/lib/tr";
import { Check } from "lucide-react";
import { BlogWriterStep1 } from "./blog-writer-step1";
import { BlogWriterStep2 } from "./blog-writer-step2";
import { BlogWriterStep3 } from "./blog-writer-step3";
import useSWR from "swr";

type TemplateInfo = {
  id: number;
  title: string;
  templateType: string;
  widgetCount: number;
  hasLorem: boolean;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BlogWriter() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [createdPages, setCreatedPages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: rawTemplates } = useSWR("/api/templates?per_page=50", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const templates: TemplateInfo[] = useMemo(() => {
    if (!Array.isArray(rawTemplates)) return [];
    return rawTemplates
      .filter((t: Record<string, unknown>) => {
        const meta = t.meta as Record<string, string> | undefined;
        return meta?._elementor_template_type !== "kit";
      })
      .map((t: Record<string, unknown>) => {
        const meta = t.meta as Record<string, string> | undefined;
        const ed = meta?._elementor_data || "";
        return {
          id: t.id as number,
          title: ((t.title as Record<string, string>)?.rendered || "").replace(/<[^>]*>/g, ""),
          templateType: meta?._elementor_template_type || "page",
          widgetCount: (ed.match(/"widgetType"/g) || []).length,
          hasLorem: ed.toLowerCase().includes("lorem"),
        };
      });
  }, [rawTemplates]);

  const handleResearch = useCallback(async (customTopic: string) => {
    setLoading(true);
    setError("");
    setIdeas([]);
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/blog-writer/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTopic: customTopic || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGoToStep2 = useCallback(() => {
    const selected = ideas.filter((i) => selectedIds.has(i.id));
    // Pre-create plans with suggested template matches
    const newPlans = selected.map((idea) => {
      // Try to match suggested template type to actual templates
      const match = templates.find((t) =>
        t.title.toLowerCase().includes(idea.suggestedTemplateType.toLowerCase())
      );
      return {
        ideaId: idea.id,
        templateId: match?.id || templates[0]?.id || 0,
        templateName: match?.title || templates[0]?.title || "",
        title: idea.title,
        brief: idea.description,
        primaryKeyword: idea.targetKeyword,
      };
    });
    setPlans(newPlans);
    setStep(2);
  }, [ideas, selectedIds, templates]);

  const handleCreatePage = useCallback(
    async (ideaId: string) => {
      const plan = plans.find((p) => p.ideaId === ideaId);
      if (!plan) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/blog-writer/create-page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: plan.templateId,
            title: plan.title,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCreatedPages((prev) => ({ ...prev, [ideaId]: data.pageId }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Page creation failed");
      } finally {
        setLoading(false);
      }
    },
    [plans]
  );

  const toggleIdea = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updatePlan = useCallback((ideaId: string, updates: Partial<ContentPlan>) => {
    setPlans((prev) =>
      prev.map((p) => (p.ideaId === ideaId ? { ...p, ...updates } : p))
    );
  }, []);

  const steps = [
    { num: 1, label: tr.blogWriter.steps.research },
    { num: 2, label: tr.blogWriter.steps.template },
    { num: 3, label: tr.blogWriter.steps.create },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === s.num
                  ? "bg-indigo-600 text-white"
                  : step > s.num
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800"
              }`}
            >
              {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
            </div>
            <span
              className={`text-xs font-medium ${
                step === s.num ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="mx-2 h-px w-8 bg-gray-200 dark:bg-gray-700" />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {step === 1 && (
          <BlogWriterStep1
            ideas={ideas}
            selectedIds={selectedIds}
            loading={loading}
            error={error}
            onResearch={handleResearch}
            onToggleIdea={toggleIdea}
            onNext={handleGoToStep2}
          />
        )}
        {step === 2 && (
          <BlogWriterStep2
            plans={plans}
            ideas={ideas}
            templates={templates}
            onUpdatePlan={updatePlan}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <BlogWriterStep3
            plans={plans}
            createdPages={createdPages}
            loading={loading}
            error={error}
            onCreatePage={handleCreatePage}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
