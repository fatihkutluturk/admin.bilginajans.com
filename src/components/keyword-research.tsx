"use client";

import { useState, useEffect, useCallback } from "react";
import { usePersistedState } from "@/lib/use-persisted-state";
import { tr } from "@/lib/tr";
import { View } from "@/components/sidebar";
import {
  Search, Sparkles, Plus, ChevronDown, ChevronRight, ExternalLink, Check,
  TrendingUp, BarChart3, Zap,
} from "lucide-react";

type ContentIdea = {
  id: string;
  title: string;
  contentType: "blog" | "service" | "landing" | "about" | "faq" | "other";
  targetKeyword: string;
  searchVolumeHint: string;
  description: string;
  alignment: string;
  suggestedTemplateType: string;
};

type SerpBearIdea = {
  keyword: string;
  domain: string;
  country: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number;
};

type Domain = { ID: number; domain: string; keywordCount: number };

export function KeywordResearch({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [topic, setTopic] = usePersistedState("kr:topic", "");
  const [ideas, setIdeas] = usePersistedState<ContentIdea[]>("kr:ideas", []);
  const [serpbearIdeas, setSerpbearIdeas] = usePersistedState<SerpBearIdea[]>("kr:serpbearIdeas", []);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = usePersistedState("kr:domain", "");
  const [loading, setLoading] = useState(false);
  const [serpbearExpanded, setSerpbearExpanded] = useState(false);
  const [serpbearLoading, setSerpbearLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingKeywords, setAddingKeywords] = useState<Set<string>>(new Set());
  const [addedKeywords, setAddedKeywords] = usePersistedState<Set<string>>("kr:added", new Set());
  const [error, setError] = useState("");

  // Load domains for the domain selector
  useEffect(() => {
    fetch("/api/seo/domains")
      .then(r => r.json())
      .then(data => {
        const doms = data.domains || [];
        setDomains(doms);
        if (doms.length > 0 && !selectedDomain) setSelectedDomain(doms[0].domain);
      })
      .catch(() => {});
  }, []);

  // Generate ideas via Gemini (existing blog-writer research API)
  const handleResearch = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    setIdeas([]);
    setSelectedIds(new Set());
    try {
      const res = await fetch("/api/blog-writer/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTopic: topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setIdeas(data.ideas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [topic]);

  // Load SerpBear ideas
  const loadSerpbearIdeas = useCallback(async () => {
    if (!selectedDomain) return;
    setSerpbearLoading(true);
    try {
      const data = await fetch(`/api/seo/ideas?domain=${encodeURIComponent(selectedDomain)}`).then(r => r.json());
      setSerpbearIdeas(data.ideas || []);
    } catch { /* silent */ }
    finally { setSerpbearLoading(false); }
  }, [selectedDomain]);

  useEffect(() => {
    if (serpbearExpanded && serpbearIdeas.length === 0) loadSerpbearIdeas();
  }, [serpbearExpanded, loadSerpbearIdeas, serpbearIdeas.length]);

  // Add keyword to SerpBear tracking
  const handleAddToTracking = useCallback(async (keyword: string) => {
    if (!selectedDomain) return;
    setAddingKeywords(prev => new Set(prev).add(keyword));
    try {
      const res = await fetch("/api/seo/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: [{ keyword, device: "desktop", country: "TR", domain: selectedDomain }] }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setAddedKeywords(prev => new Set(prev).add(keyword));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setAddingKeywords(prev => { const n = new Set(prev); n.delete(keyword); return n; });
    }
  }, [selectedDomain]);

  // Bulk add selected keywords
  const handleBulkAdd = useCallback(async () => {
    if (!selectedDomain || selectedIds.size === 0) return;
    const kws = ideas.filter(i => selectedIds.has(i.id)).map(i => i.targetKeyword);
    for (const kw of kws) {
      await handleAddToTracking(kw);
    }
    setSelectedIds(new Set());
  }, [selectedDomain, selectedIds, ideas, handleAddToTracking]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const contentTypeColors: Record<string, string> = {
    blog: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    service: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    landing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    faq: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    about: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{tr.research.title}</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{tr.research.subtitle}</p>
          </div>
          {selectedIds.size > 0 && selectedDomain && (
            <button onClick={handleBulkAdd} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              <Plus className="h-4 w-4" />
              {tr.research.bulkAddToTracking} ({selectedIds.size} {tr.research.selected})
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleResearch(); }}
              placeholder={tr.research.seedPlaceholder}
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button onClick={handleResearch} disabled={loading || !topic.trim()} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            <Sparkles className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
            {loading ? tr.research.generating : tr.research.generate}
          </button>
        </div>

        {/* Domain selector */}
        {domains.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Takip alan adı:</span>
            <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
              {domains.map(d => <option key={d.ID} value={d.domain}>{d.domain}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div className="mx-6 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {loading && (
          <div className="flex h-64 flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            <p className="mt-3 text-sm text-gray-500">{tr.research.generating}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && ideas.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center text-sm text-gray-400">
            <TrendingUp className="mb-3 h-10 w-10 text-gray-300" />
            <p>{tr.research.noResults}</p>
          </div>
        )}

        {/* Automation note */}
        {!loading && ideas.length > 0 && (
          <div className="mx-6 mt-2 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-2 text-xs text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/10 dark:text-indigo-400">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Araştırma sonuçlarınız otomatik olarak saklanır. Takibe aldığınız kelimeler <strong>her gün otomatik taranır.</strong></span>
          </div>
        )}

        {/* AI Ideas results */}
        {!loading && ideas.length > 0 && (
          <div className="px-6 py-4 space-y-3">
            {ideas.map(idea => {
              const isAdding = addingKeywords.has(idea.targetKeyword);
              const isAdded = addedKeywords.has(idea.targetKeyword);
              const isSelected = selectedIds.has(idea.id);
              return (
                <div key={idea.id} className={`rounded-xl border p-4 transition-all ${isSelected ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-900/10" : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"}`}>
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(idea.id)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 hover:border-indigo-400 dark:border-gray-600"}`}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{idea.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${contentTypeColors[idea.contentType] || contentTypeColors.other}`}>
                          {tr.blogWriter.contentTypes[idea.contentType] || idea.contentType}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Search className="h-3 w-3" />
                          {idea.targetKeyword}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {idea.searchVolumeHint}
                          <span className="text-gray-300">({tr.research.aiEstimate})</span>
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{idea.description}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1.5">
                      {selectedDomain && (
                        <button
                          onClick={() => handleAddToTracking(idea.targetKeyword)}
                          disabled={isAdding || isAdded}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isAdded ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-indigo-900/20"}`}
                        >
                          {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {isAdded ? tr.research.addedToTracking : isAdding ? tr.seo.adding : tr.research.addToTracking}
                        </button>
                      )}
                      <button
                        onClick={() => onNavigate("blog-writer")}
                        className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-indigo-900/20"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {tr.research.createContent}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SerpBear Ideas (collapsible) */}
        {selectedDomain && (
          <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800/60">
            <button onClick={() => setSerpbearExpanded(!serpbearExpanded)} className="flex w-full items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
              {serpbearExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {tr.research.serpbearIdeas}
              {serpbearIdeas.length > 0 && <span className="text-xs font-normal text-gray-400">({serpbearIdeas.length})</span>}
            </button>
            {serpbearExpanded && (
              <div className="mt-1 text-xs text-gray-400 mb-3">{tr.research.serpbearIdeasDesc}</div>
            )}

            {serpbearExpanded && serpbearLoading && (
              <div className="flex h-24 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" /></div>
            )}

            {serpbearExpanded && !serpbearLoading && serpbearIdeas.length === 0 && (
              <p className="mt-2 text-xs text-gray-400">{tr.research.noSerpbearIdeas}</p>
            )}

            {serpbearExpanded && !serpbearLoading && serpbearIdeas.length > 0 && (
              <div className="mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 uppercase tracking-wider">
                      <th className="pb-2">{tr.seo.keywords}</th>
                      <th className="pb-2 text-right">{tr.research.monthlySearches}</th>
                      <th className="pb-2 text-right">{tr.research.competition}</th>
                      <th className="pb-2 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {serpbearIdeas.slice(0, 50).map((idea, i) => {
                      const isAdded = addedKeywords.has(idea.keyword);
                      const isAdding = addingKeywords.has(idea.keyword);
                      return (
                        <tr key={i}>
                          <td className="py-2 text-gray-700 dark:text-gray-300">{idea.keyword}</td>
                          <td className="py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{idea.avgMonthlySearches?.toLocaleString() || "-"}</td>
                          <td className="py-2 text-right">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              idea.competition === "LOW" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              idea.competition === "MEDIUM" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}>
                              {tr.research.competitionLevels[idea.competition as keyof typeof tr.research.competitionLevels] || idea.competition}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => handleAddToTracking(idea.keyword)}
                              disabled={isAdding || isAdded}
                              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${isAdded ? "text-green-600" : "text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"}`}
                            >
                              {isAdded ? tr.research.addedToTracking : isAdding ? "..." : tr.research.addToTracking}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
