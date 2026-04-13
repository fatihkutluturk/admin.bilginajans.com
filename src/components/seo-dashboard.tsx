"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { usePersistedState } from "@/lib/use-persisted-state";
import { tr } from "@/lib/tr";
import {
  Search, RefreshCw, ArrowUp, ArrowDown, Minus, ChevronLeft, ChevronRight, Monitor, Smartphone,
  Sparkles, Globe, TrendingUp, TrendingDown, Trophy, Target, Settings, Plus, Trash2, X,
  MousePointerClick, Eye, Percent, Hash, Zap,
} from "lucide-react";

// ---- Types ----

type Domain = { ID: number; domain: string; slug: string; keywordCount: number };
type KeywordHistory = Record<string, number>;
type Keyword = {
  ID: number; keyword: string; device: string; country: string; domain: string;
  position: number; url: string; tags: string[]; history: KeywordHistory;
  lastUpdated: string; updating: boolean;
};
type Insight = { type: "quick_win" | "declining" | "opportunity" | "strong"; keyword: string; position: number; change: number; message: string };
type SCPeriod = { impressions: number; clicks: number; ctr: number; position: number };
type SCAggregated = { sevenDays: SCPeriod; thirtyDays: SCPeriod; stats: Array<{ date: string; impressions: number; clicks: number }>; hasData: boolean };
type InsightPage = { page: string; clicks: number; impressions: number; ctr: number; position: number };
type InsightKeyword = { keyword: string; clicks: number; impressions: number; ctr: number; position: number };
type InsightApiData = { pages: InsightPage[]; keywords: InsightKeyword[] };
type CompetitorKeyword = { keyword: string; theirPosition: number; yourPosition: number };
type CompetitorEntry = { domain: string; keywordsInCommon: number; avgPosition: number; keywords: CompetitorKeyword[] };
type SerpByKeyword = { keyword: string; yourPosition: number; topCompetitors: Array<{ domain: string; position: number; title: string; url: string }> };
type PageSpeedResult = {
  url: string; fetchedAt: string;
  scores: { performance: number; seo: number; accessibility: number; bestPractices: number };
  webVitals: Record<string, { value: number; unit: string; rating: "good" | "needs-improvement" | "poor" }>;
  error?: string;
};
type Tab = "overview" | "rankings" | "competitors" | "performance" | "insights";
type RankSubView = "list" | "detail" | "add-keyword";

export function SeoDashboard({ onNavigateSettings }: { onNavigateSettings: () => void }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = usePersistedState<string>("seo:domain", "");
  const [tab, setTab] = usePersistedState<Tab>("seo:tab", "overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);

  // GSC state
  const [scData, setScData] = useState<SCAggregated | null>(null);
  const [insightApiData, setInsightApiData] = useState<InsightApiData | null>(null);
  const [scLoading, setScLoading] = useState(false);

  // Rankings state
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [rankSubView, setRankSubView] = useState<RankSubView>("list");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"keyword" | "position" | "change">("position");
  const [sortAsc, setSortAsc] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [success, setSuccess] = useState("");

  // Insights state
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Competitors state
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [serpByKeyword, setSerpByKeyword] = useState<SerpByKeyword[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [trackedCompetitors, setTrackedCompetitors] = usePersistedState<string[]>("seo:trackedCompetitors", []);

  // Load domains
  const loadDomains = useCallback(async () => {
    try {
      const r = await fetch("/api/seo/domains");
      const data = await r.json();
      if (data.error?.includes("yapılandırılmalı")) { setConfigured(false); return; }
      setDomains(data.domains || []);
      if (data.domains?.length > 0 && !selectedDomain) setSelectedDomain(data.domains[0].domain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("500")) setConfigured(false); else setError(msg);
    }
  }, [selectedDomain]);

  useEffect(() => { loadDomains().finally(() => setLoading(false)); }, [loadDomains]);

  // Load GSC + insight when domain or tab changes
  const loadGscData = useCallback(async () => {
    if (!selectedDomain) return;
    setScLoading(true);
    try {
      const [scRes, insightRes] = await Promise.all([
        fetch(`/api/seo/searchconsole?domain=${encodeURIComponent(selectedDomain)}`).then(r => r.json()),
        fetch(`/api/seo/insight?domain=${encodeURIComponent(selectedDomain)}`).then(r => r.json()),
      ]);
      setScData(scRes.data || null);
      setInsightApiData(insightRes.data || null);
    } catch { /* silent */ } finally { setScLoading(false); }
  }, [selectedDomain]);

  useEffect(() => { if (tab === "overview") loadGscData(); }, [tab, loadGscData]);

  // Load keywords
  const loadKeywords = useCallback(async () => {
    if (!selectedDomain) return;
    setKeywordsLoading(true);
    try {
      const data = await fetch(`/api/seo/keywords?domain=${encodeURIComponent(selectedDomain)}`).then(r => r.json());
      setKeywords(data.keywords || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setKeywordsLoading(false); }
  }, [selectedDomain]);

  useEffect(() => { if (tab === "rankings" || tab === "overview") loadKeywords(); }, [tab, loadKeywords]);

  // Load insights
  const loadInsights = useCallback(async () => {
    if (!selectedDomain) return;
    setInsightsLoading(true);
    try {
      const data = await fetch("/api/seo/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: selectedDomain }) }).then(r => r.json());
      setInsights(data.insights || []);
    } catch { /* silent */ } finally { setInsightsLoading(false); }
  }, [selectedDomain]);

  useEffect(() => { if (tab === "insights") loadInsights(); }, [tab, loadInsights]);

  // Load competitors
  const loadCompetitors = useCallback(async () => {
    if (!selectedDomain) return;
    setCompetitorsLoading(true);
    try {
      const data = await fetch("/api/seo/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: selectedDomain }) }).then(r => r.json());
      setCompetitors(data.competitors || []);
      setSerpByKeyword(data.serpByKeyword || []);
    } catch { /* silent */ } finally { setCompetitorsLoading(false); }
  }, [selectedDomain]);

  useEffect(() => { if (tab === "competitors") loadCompetitors(); }, [tab, loadCompetitors]);

  const handleDeleteKeyword = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(tr.seo.deleteConfirm)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/seo/keywords?ids=${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setKeywords(prev => prev.filter(kw => kw.ID !== id));
      setSuccess(tr.seo.deleted); setTimeout(() => setSuccess(""), 2000);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setDeletingId(null); }
  }, []);

  const getPositionChange = (kw: Keyword): number => {
    const entries = Object.entries(kw.history || {}).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
    if (entries.length < 2) return 0;
    const latest = entries[0][1]; const previous = entries[Math.min(6, entries.length - 1)][1];
    if (previous <= 0 || latest <= 0) return 0;
    return previous - latest;
  };

  // Not configured
  if (!configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/30">
            <Globe className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tr.seo.notConfigured}</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{tr.seo.notConfiguredDesc}</p>
          <button onClick={onNavigateSettings} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            <Settings className="h-4 w-4" />{tr.seo.goToSettings}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" /></div>;

  // Rankings detail sub-view
  if (tab === "rankings" && rankSubView === "detail" && selectedKeyword) {
    return <KeywordDetail keyword={selectedKeyword} onBack={() => { setRankSubView("list"); setSelectedKeyword(null); }} />;
  }
  if (tab === "rankings" && rankSubView === "add-keyword" && selectedDomain) {
    return <AddKeywordView domain={selectedDomain} onBack={() => setRankSubView("list")} onAdded={() => { setRankSubView("list"); loadKeywords(); loadDomains(); }} />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{tr.seo.title}</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{tr.seo.subtitle}</p>
          </div>
          {tab === "rankings" && selectedDomain && (
            <button onClick={() => setRankSubView("add-keyword")} className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors dark:border-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
              <Plus className="h-4 w-4" />{tr.seo.addKeyword}
            </button>
          )}
        </div>

        {/* Domain selector */}
        {domains.length > 0 && (
          <div className="mt-4">
            <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
              {domains.map(d => <option key={d.ID} value={d.domain}>{d.domain}</option>)}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {(["overview", "rankings", "competitors", "performance", "insights"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === t ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}>
              {tr.seo.tabs[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {error && <div className="mx-6 mt-3 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}<button onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
      {success && <div className="mx-6 mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">{success}</div>}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && <OverviewTab scData={scData} insightData={insightApiData} loading={scLoading} keywords={keywords} />}
        {tab === "rankings" && <RankingsTab keywords={keywords} loading={keywordsLoading} search={search} setSearch={setSearch} sortField={sortField} setSortField={setSortField} sortAsc={sortAsc} setSortAsc={setSortAsc} getPositionChange={getPositionChange} deletingId={deletingId} onDelete={handleDeleteKeyword} onSelect={kw => { setSelectedKeyword(kw); setRankSubView("detail"); }} />}
        {tab === "competitors" && <CompetitorsTab competitors={competitors} serpByKeyword={serpByKeyword} loading={competitorsLoading} trackedCompetitors={trackedCompetitors} onToggleTrack={(domain) => setTrackedCompetitors(prev => prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain])} />}
        {tab === "performance" && <PerformanceTab domain={selectedDomain} trackedCompetitors={trackedCompetitors} />}
        {tab === "insights" && <InsightsTab insights={insights} loading={insightsLoading} />}
      </div>
    </div>
  );
}

// ---- Overview Tab ----

function OverviewTab({ scData, insightData, loading, keywords }: { scData: SCAggregated | null; insightData: InsightApiData | null; loading: boolean; keywords: Keyword[] }) {
  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" /></div>;

  const d7 = scData?.sevenDays;
  const d30 = scData?.thirtyDays;
  const hasGsc = scData?.hasData;

  // Automation card data
  const lastUpdatedKw = keywords.filter(kw => kw.lastUpdated).sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
  const lastScanTime = lastUpdatedKw?.lastUpdated;
  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)} gün ${tr.seo.automation.ago}`;
    if (hours > 0) return `${hours} saat ${tr.seo.automation.ago}`;
    return `${mins} dk ${tr.seo.automation.ago}`;
  };

  return (
    <div className="px-6 py-4 space-y-6">
      {/* Automation card */}
      <div className="rounded-xl border border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 p-4 dark:border-green-800/40 dark:from-green-900/10 dark:to-emerald-900/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
            <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">{tr.seo.automation.autoScans}</h3>
            <p className="text-xs text-green-600/70 dark:text-green-400/60">{tr.seo.automation.autoScansDesc}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-6 text-xs text-green-700/70 dark:text-green-400/60">
          <span>{tr.seo.automation.trackedKeywords}: <strong className="text-green-800 dark:text-green-300">{keywords.length}</strong></span>
          <span>{tr.seo.automation.lastScan}: <strong className="text-green-800 dark:text-green-300">{lastScanTime ? formatTimeAgo(lastScanTime) : tr.seo.automation.neverScanned}</strong></span>
          <span>Tarama sıklığı: <strong className="text-green-800 dark:text-green-300">{tr.seo.automation.daily}</strong></span>
        </div>
      </div>

      {/* GSC metric cards */}
      {hasGsc ? (
        <div className="grid grid-cols-4 gap-3">
          <GscCard icon={<MousePointerClick className="h-5 w-5 text-indigo-500" />} label={tr.seo.clicks} value={d7!.clicks} prevValue={d30 ? Math.round(d30.clicks * 7 / 30) : undefined} format="number" />
          <GscCard icon={<Eye className="h-5 w-5 text-blue-500" />} label={tr.seo.impressions} value={d7!.impressions} prevValue={d30 ? Math.round(d30.impressions * 7 / 30) : undefined} format="number" />
          <GscCard icon={<Percent className="h-5 w-5 text-green-500" />} label={tr.seo.ctr} value={d7!.ctr / 100} prevValue={d30 ? d30.ctr / 100 : undefined} format="percent" />
          <GscCard icon={<Hash className="h-5 w-5 text-orange-500" />} label={tr.seo.avgPositionLabel} value={d7!.position} prevValue={d30 ? d30.position : undefined} format="position" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900/50">
          {tr.seo.gscNotConnected}
        </div>
      )}

      {/* Performance chart */}
      {scData?.stats && scData.stats.length > 1 && <PerformanceChart stats={scData.stats as Array<{ date: string; clicks: number; impressions: number }>} />}

      {/* Top pages & keywords side by side */}
      {insightData && (
        <div className="grid grid-cols-2 gap-4">
          {insightData.pages?.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{tr.seo.topPages}</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400 uppercase tracking-wider"><th className="pb-2 text-left">{tr.seo.page}</th><th className="pb-2 text-right">{tr.seo.clicks}</th><th className="pb-2 text-right">{tr.seo.impressions}</th><th className="pb-2 text-right">{tr.seo.position}</th></tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {insightData.pages.slice(0, 10).map((p, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{p.page.replace(/^https?:\/\/[^/]+/, "")}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{p.clicks.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{p.impressions.toLocaleString()}</td>
                      <td className="py-1.5 text-right"><PositionBadge position={Math.round(p.position)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {insightData.keywords?.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{tr.seo.topKeywords}</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400 uppercase tracking-wider"><th className="pb-2 text-left">{tr.seo.keywords}</th><th className="pb-2 text-right">{tr.seo.clicks}</th><th className="pb-2 text-right">{tr.seo.impressions}</th><th className="pb-2 text-right">{tr.seo.position}</th></tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {insightData.keywords.slice(0, 10).map((k, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-gray-700 dark:text-gray-300">{k.keyword}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{k.clicks.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{k.impressions.toLocaleString()}</td>
                      <td className="py-1.5 text-right"><PositionBadge position={Math.round(k.position)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GscCard({ icon, label, value, prevValue, format }: { icon: React.ReactNode; label: string; value: number; prevValue?: number; format: "number" | "percent" | "position" }) {
  const display = format === "percent" ? `${(value * 100).toFixed(1)}%` : format === "position" ? value.toFixed(1) : value.toLocaleString();
  let changeEl = null;
  if (prevValue !== undefined && prevValue !== 0) {
    const diff = format === "position" ? prevValue - value : value - (prevValue || 1); // positive = good for position (lower)
    const pct = format === "percent" ? ((value - prevValue) * 100).toFixed(1) : format === "position" ? (prevValue - value).toFixed(1) : (prevValue > 0 ? ((value - prevValue) / prevValue * 100).toFixed(0) : "0");
    const isGood = format === "position" ? diff > 0 : Number(pct) > 0;
    changeEl = (
      <span className={`ml-2 inline-flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
        {isGood ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {format === "percent" ? `${Math.abs(Number(pct))}%` : Math.abs(Number(pct))}{format === "number" ? "%" : ""}
      </span>
    );
  }
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">{icon}{label}</div>
      <div className="mt-2 flex items-baseline">
        <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{display}</span>
        {changeEl}
      </div>
      <p className="mt-0.5 text-xs text-gray-400">{tr.seo.period7d}</p>
    </div>
  );
}

function PerformanceChart({ stats }: { stats: Array<{ date: string; clicks: number; impressions: number }> }) {
  const sorted = [...stats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-30);
  if (sorted.length < 2) return null;
  const maxClicks = Math.max(...sorted.map(s => s.clicks), 1);
  const maxImpressions = Math.max(...sorted.map(s => s.impressions), 1);

  const clickPoints = sorted.map((s, i) => {
    const x = 50 + (i / (sorted.length - 1)) * 720;
    const y = 170 - (s.clicks / maxClicks) * 150;
    return `${x},${y}`;
  }).join(" ");

  const impressionPoints = sorted.map((s, i) => {
    const x = 50 + (i / (sorted.length - 1)) * 720;
    const y = 170 - (s.impressions / maxImpressions) * 150;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tr.seo.performance}</h3>
        <div className="flex gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />{tr.seo.clicks}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" />{tr.seo.impressions}</span>
        </div>
      </div>
      <svg viewBox="0 0 800 190" className="w-full" preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map(frac => <line key={frac} x1="50" y1={170 - frac * 150} x2="770" y2={170 - frac * 150} stroke="#f3f4f6" strokeWidth="0.5" />)}
        <polyline fill="none" stroke="#c7c7cc" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 3" points={impressionPoints} />
        <polyline fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" points={clickPoints} />
        {sorted.filter((_, i) => i % Math.max(1, Math.floor(sorted.length / 7)) === 0 || i === sorted.length - 1).map((s, idx) => {
          const i = sorted.indexOf(s);
          const x = 50 + (i / (sorted.length - 1)) * 720;
          return <text key={idx} x={x} y="188" textAnchor="middle" fontSize="8" fill="#9ca3af">{new Date(s.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}</text>;
        })}
      </svg>
    </div>
  );
}

// ---- Rankings Tab ----

function RankingsTab({ keywords, loading, search, setSearch, sortField, setSortField, sortAsc, setSortAsc, getPositionChange, deletingId, onDelete, onSelect }: {
  keywords: Keyword[]; loading: boolean; search: string; setSearch: (s: string) => void;
  sortField: "keyword" | "position" | "change"; setSortField: (f: "keyword" | "position" | "change") => void;
  sortAsc: boolean; setSortAsc: (a: boolean) => void;
  getPositionChange: (kw: Keyword) => number; deletingId: number | null;
  onDelete: (id: number, e: React.MouseEvent) => void; onSelect: (kw: Keyword) => void;
}) {
  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" /></div>;

  const filtered = keywords
    .filter(kw => kw.keyword.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "keyword") cmp = a.keyword.localeCompare(b.keyword);
      else if (sortField === "position") cmp = a.position - b.position;
      else cmp = getPositionChange(b) - getPositionChange(a);
      return sortAsc ? cmp : -cmp;
    });

  const activeKws = keywords.filter(kw => kw.position > 0);
  const avg = activeKws.length > 0 ? Math.round(activeKws.reduce((s, kw) => s + kw.position, 0) / activeKws.length) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Mini stats + search */}
      <div className="border-b border-gray-50 px-6 py-3 dark:border-gray-800/30">
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>{tr.seo.totalKeywords}: <strong className="text-gray-900 dark:text-white">{keywords.length}</strong></span>
          <span>{tr.seo.avgPosition}: <strong className="text-gray-900 dark:text-white">{avg}</strong></span>
          <span>{tr.seo.top10}: <strong className="text-indigo-600 dark:text-indigo-400">{activeKws.filter(kw => kw.position <= 10).length}</strong></span>
        </div>
        {keywords.length > 0 && (
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={tr.common.search} className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>
        )}
      </div>

      {keywords.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">{tr.seo.noKeywords}</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur dark:bg-gray-950/95">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                <th className="cursor-pointer px-6 py-3 hover:text-gray-600" onClick={() => { if (sortField === "keyword") setSortAsc(!sortAsc); else { setSortField("keyword"); setSortAsc(true); } }}>{tr.seo.keywords}</th>
                <th className="cursor-pointer px-3 py-3 text-center hover:text-gray-600" onClick={() => { if (sortField === "position") setSortAsc(!sortAsc); else { setSortField("position"); setSortAsc(true); } }}>{tr.seo.position}</th>
                <th className="cursor-pointer px-3 py-3 text-center hover:text-gray-600" onClick={() => { if (sortField === "change") setSortAsc(!sortAsc); else { setSortField("change"); setSortAsc(false); } }}>{tr.seo.change}</th>
                <th className="px-3 py-3 text-center">{tr.seo.bestPosition}</th>
                <th className="px-3 py-3 text-center">{tr.seo.device}</th>
                <th className="px-3 py-3">{tr.seo.lastUpdated}</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {filtered.map(kw => {
                const change = getPositionChange(kw);
                const histVals = Object.values(kw.history || {}).filter(v => v > 0);
                const bestPos = histVals.length > 0 ? Math.min(kw.position > 0 ? kw.position : Infinity, ...histVals) : (kw.position > 0 ? kw.position : 0);
                return (
                  <tr key={kw.ID} onClick={() => onSelect(kw)} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-6 py-3"><div className="text-sm font-medium text-gray-900 dark:text-white">{kw.keyword}</div>{kw.url && <div className="text-xs text-gray-400 truncate max-w-xs">{kw.url.replace(/^https?:\/\/[^/]+/, "")}</div>}</td>
                    <td className="px-3 py-3 text-center"><PositionBadge position={kw.position} /></td>
                    <td className="px-3 py-3 text-center"><ChangeBadge change={change} /></td>
                    <td className="px-3 py-3 text-center"><span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{bestPos > 0 && bestPos < Infinity ? bestPos : "-"}</span></td>
                    <td className="px-3 py-3 text-center">{kw.device === "mobile" ? <Smartphone className="inline h-4 w-4 text-gray-400" /> : <Monitor className="inline h-4 w-4 text-gray-400" />}</td>
                    <td className="px-3 py-3 text-xs text-gray-400">{kw.lastUpdated ? new Date(kw.lastUpdated).toLocaleDateString("tr-TR") : "-"}</td>
                    <td className="px-3 py-3 text-center"><button onClick={e => onDelete(kw.ID, e)} disabled={deletingId === kw.ID} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors dark:hover:bg-red-900/20" title={tr.seo.deleteKeyword}><Trash2 className={`h-3.5 w-3.5 ${deletingId === kw.ID ? "animate-pulse" : ""}`} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-400">{tr.common.noResults}</div>}
        </div>
      )}
    </div>
  );
}

// ---- Insights Tab ----

function InsightsTab({ insights, loading }: { insights: Insight[]; loading: boolean }) {
  if (loading) return <div className="flex h-64 flex-col items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" /><p className="mt-3 text-sm text-gray-500">{tr.seo.analyzing}</p></div>;
  if (insights.length === 0) return <div className="flex h-64 items-center justify-center text-sm text-gray-400">{tr.seo.noInsights}</div>;

  const insightIcon = (type: string) => { switch (type) { case "quick_win": return <Target className="h-5 w-5 text-yellow-500" />; case "declining": return <TrendingDown className="h-5 w-5 text-red-500" />; case "strong": return <Trophy className="h-5 w-5 text-green-500" />; default: return <TrendingUp className="h-5 w-5 text-blue-500" />; } };
  const insightBg = (type: string) => { switch (type) { case "quick_win": return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10"; case "declining": return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10"; case "strong": return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10"; default: return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10"; } };

  return (
    <div className="px-6 py-4 space-y-3">
      {insights.map((ins, i) => (
        <div key={i} className={`flex items-start gap-3 rounded-xl border p-4 ${insightBg(ins.type)}`}>
          <div className="mt-0.5 shrink-0">{insightIcon(ins.type)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold dark:bg-gray-900/40">{tr.seo.insightTypes[ins.type as keyof typeof tr.seo.insightTypes]}</span>
              <PositionBadge position={ins.position} />
              <ChangeBadge change={ins.change} />
            </div>
            <p className="mt-1.5 text-sm text-gray-700 dark:text-gray-300">{ins.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Competitors Tab ----

function CompetitorsTab({ competitors, serpByKeyword, loading, trackedCompetitors, onToggleTrack }: {
  competitors: CompetitorEntry[]; serpByKeyword: SerpByKeyword[]; loading: boolean;
  trackedCompetitors: string[]; onToggleTrack: (domain: string) => void;
}) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  if (loading) return <div className="flex h-64 flex-col items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" /><p className="mt-3 text-sm text-gray-500">{tr.seo.competitors.loading}</p></div>;
  if (competitors.length === 0) return <div className="flex h-64 items-center justify-center text-sm text-gray-400">{tr.seo.competitors.noData}</div>;

  const tracked = competitors.filter(c => trackedCompetitors.includes(c.domain));
  const untracked = competitors.filter(c => !trackedCompetitors.includes(c.domain));

  const renderCompetitorRow = (comp: CompetitorEntry) => {
    const isExpanded = expandedDomain === comp.domain;
    const isTracked = trackedCompetitors.includes(comp.domain);
    return (
      <Fragment key={comp.domain}>
        <tr className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50">
          <td className="px-4 py-3" onClick={() => setExpandedDomain(isExpanded ? null : comp.domain)}>
            <div className="flex items-center gap-2">
              <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              <span className="text-sm font-medium text-gray-900 dark:text-white">{comp.domain}</span>
              {isTracked && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{tr.seo.competitors.tracked}</span>}
            </div>
          </td>
          <td className="px-4 py-3 text-center" onClick={() => setExpandedDomain(isExpanded ? null : comp.domain)}>
            <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              {comp.keywordsInCommon}
            </span>
          </td>
          <td className="px-4 py-3 text-center" onClick={() => setExpandedDomain(isExpanded ? null : comp.domain)}>
            <PositionBadge position={Math.round(comp.avgPosition)} />
          </td>
          <td className="px-4 py-3 text-center">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTrack(comp.domain); }}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${isTracked
                ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
              }`}
            >
              {isTracked ? tr.seo.competitors.untrack : tr.seo.competitors.track}
            </button>
          </td>
        </tr>
        {isExpanded && (
          <tr>
            <td colSpan={4} className="bg-gray-50/50 px-4 py-3 dark:bg-gray-900/30">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider">
                    <th className="pb-2 text-left">{tr.seo.keywords}</th>
                    <th className="pb-2 text-center">{tr.seo.competitors.yourPos}</th>
                    <th className="pb-2 text-center">{tr.seo.competitors.theirPos}</th>
                    <th className="pb-2 text-center">{tr.seo.change}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/30">
                  {comp.keywords.map((kw, i) => {
                    const diff = kw.yourPosition > 0 ? kw.theirPosition - kw.yourPosition : 0;
                    return (
                      <tr key={i}>
                        <td className="py-1.5 text-gray-700 dark:text-gray-300">{kw.keyword}</td>
                        <td className="py-1.5 text-center"><PositionBadge position={kw.yourPosition} /></td>
                        <td className="py-1.5 text-center"><PositionBadge position={kw.theirPosition} /></td>
                        <td className="py-1.5 text-center">
                          {kw.yourPosition > 0 ? (
                            <span className={`text-xs font-medium ${diff > 0 ? "text-green-600 dark:text-green-400" : diff < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>
                              {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "="}
                            </span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const tableHeader = (
    <thead>
      <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 bg-gray-50/80 dark:bg-gray-950/50">
        <th className="px-4 py-3">{tr.seo.competitors.domain}</th>
        <th className="px-4 py-3 text-center">{tr.seo.competitors.commonKeywords}</th>
        <th className="px-4 py-3 text-center">{tr.seo.competitors.theirAvgPos}</th>
        <th className="px-4 py-3 text-center w-24"></th>
      </tr>
    </thead>
  );

  return (
    <div className="px-6 py-4 space-y-6">
      {/* Tracked Competitors */}
      {tracked.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Eye className="h-4 w-4 text-indigo-500" />
            {tr.seo.competitors.trackedTitle}
            <span className="text-xs font-normal text-gray-400">({tracked.length})</span>
          </h3>
          <div className="rounded-xl border-2 border-indigo-200 bg-white dark:border-indigo-800 dark:bg-gray-900 overflow-hidden">
            <table className="w-full">
              {tableHeader}
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {tracked.map(renderCompetitorRow)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Competitors */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          {tr.seo.competitors.topCompetitors}
          <span className="ml-2 text-xs font-normal text-gray-400">{tr.seo.competitors.trackHint}</span>
        </h3>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <table className="w-full">
            {tableHeader}
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {untracked.slice(0, 20).map(renderCompetitorRow)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Keyword SERP View — highlight tracked competitors */}
      {serpByKeyword.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{tr.seo.competitors.perKeyword}</h3>
          <div className="space-y-3">
            {serpByKeyword.map((item) => (
              <div key={item.keyword} className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">&quot;{item.keyword}&quot;</h4>
                  <PositionBadge position={item.yourPosition} />
                </div>
                <div className="space-y-1">
                  {item.topCompetitors.slice(0, 7).map((comp, i) => {
                    const isYouAbove = item.yourPosition > 0 && item.yourPosition < comp.position;
                    const isTracked = trackedCompetitors.includes(comp.domain);
                    return (
                      <div key={i} className={`flex items-center gap-3 text-xs rounded px-1.5 py-0.5 ${isTracked ? "bg-indigo-50 dark:bg-indigo-900/10" : ""}`}>
                        <span className={`w-6 text-center font-semibold tabular-nums ${comp.position <= 3 ? "text-green-600 dark:text-green-400" : comp.position <= 10 ? "text-blue-600 dark:text-blue-400" : "text-gray-500"}`}>
                          {comp.position}
                        </span>
                        <span className={`flex-1 truncate ${isTracked ? "font-semibold text-indigo-700 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}>{comp.domain}</span>
                        <span className="truncate max-w-[200px] text-gray-400">{comp.title}</span>
                        {isTracked && <span className="shrink-0 rounded bg-indigo-100 px-1 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{tr.seo.competitors.tracked}</span>}
                        {isYouAbove && !isTracked && <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Siz öndesiniz</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Performance Tab ----

function PerformanceTab({ domain, trackedCompetitors }: { domain: string; trackedCompetitors: string[] }) {
  const [results, setResults] = usePersistedState<Record<string, PageSpeedResult>>("seo:pagespeed", {});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());

  const allUrls = [domain, ...trackedCompetitors].filter(Boolean);

  const analyzeUrl = async (url: string) => {
    setAnalyzing(prev => new Set(prev).add(url));
    try {
      const res = await fetch(`/api/seo/pagespeed?url=${encodeURIComponent(url)}`);
      const data: PageSpeedResult = await res.json();
      setResults(prev => ({ ...prev, [url]: data }));
    } catch { /* silent */ }
    finally { setAnalyzing(prev => { const n = new Set(prev); n.delete(url); return n; }); }
  };

  const analyzeAll = async () => {
    for (const url of allUrls) {
      if (!results[url] || analyzing.has(url)) await analyzeUrl(url);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const scoreBg = (score: number) => {
    if (score >= 90) return "stroke-green-500";
    if (score >= 50) return "stroke-yellow-500";
    return "stroke-red-500";
  };

  const ratingColor = (rating: string) => {
    if (rating === "good") return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20";
    if (rating === "needs-improvement") return "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20";
    return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20";
  };

  const ratingLabel = (rating: string) => {
    if (rating === "good") return tr.seo.pagespeed.good;
    if (rating === "needs-improvement") return tr.seo.pagespeed.needsImprovement;
    return tr.seo.pagespeed.poor;
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (hours > 24) return `${Math.floor(hours / 24)} gün önce`;
    if (hours > 0) return `${hours} saat önce`;
    if (mins > 0) return `${mins} dk önce`;
    return "az önce";
  };

  if (trackedCompetitors.length === 0) {
    return (
      <div className="px-6 py-4">
        {/* Still show own site */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tr.seo.pagespeed.title}</h3>
          {domain && !results[domain] && (
            <button onClick={() => analyzeUrl(domain)} disabled={analyzing.has(domain)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {analyzing.has(domain) ? tr.seo.pagespeed.analyzing : tr.seo.pagespeed.analyze}
            </button>
          )}
        </div>
        {results[domain] && <ScoreCard result={results[domain]} label={tr.seo.pagespeed.yourSite} scoreColor={scoreColor} scoreBg={scoreBg} ratingColor={ratingColor} ratingLabel={ratingLabel} formatTimeAgo={formatTimeAgo} onReanalyze={() => analyzeUrl(domain)} analyzing={analyzing.has(domain)} />}
        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900/50">
          {tr.seo.pagespeed.noTrackedCompetitors}
        </div>
      </div>
    );
  }

  const hasAnyResult = allUrls.some(u => results[u]);

  return (
    <div className="px-6 py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tr.seo.pagespeed.title}</h3>
          <p className="text-xs text-gray-400">{tr.seo.pagespeed.desc}</p>
        </div>
        <button onClick={analyzeAll} disabled={analyzing.size > 0} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {analyzing.size > 0 ? tr.seo.pagespeed.analyzing : (hasAnyResult ? tr.seo.pagespeed.reanalyze : tr.seo.pagespeed.analyze)}
        </button>
      </div>

      {/* Score comparison table */}
      {hasAnyResult && (
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 bg-gray-50/80 dark:bg-gray-950/50">
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3 text-center">{tr.seo.pagespeed.performance}</th>
                <th className="px-4 py-3 text-center">{tr.seo.pagespeed.seoScore}</th>
                <th className="px-4 py-3 text-center">{tr.seo.pagespeed.accessibility}</th>
                <th className="px-4 py-3 text-center">{tr.seo.pagespeed.bestPractices}</th>
                <th className="px-4 py-3 text-center">LCP</th>
                <th className="px-4 py-3 text-center">CLS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {allUrls.map(url => {
                const r = results[url];
                const isYou = url === domain;
                if (!r) return (
                  <tr key={url}>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isYou ? "font-semibold text-indigo-700 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}>{url}</span>
                      {isYou && <span className="ml-2 text-xs text-indigo-500">({tr.seo.pagespeed.yourSite.toLowerCase()})</span>}
                    </td>
                    <td colSpan={6} className="px-4 py-3 text-center">
                      <button onClick={() => analyzeUrl(url)} disabled={analyzing.has(url)} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                        {analyzing.has(url) ? tr.seo.pagespeed.analyzing : tr.seo.pagespeed.analyze}
                      </button>
                    </td>
                  </tr>
                );
                return (
                  <tr key={url} className={isYou ? "bg-indigo-50/30 dark:bg-indigo-900/5" : ""}>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isYou ? "font-semibold text-indigo-700 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}>{url}</span>
                      {isYou && <span className="ml-2 text-xs text-indigo-500">({tr.seo.pagespeed.yourSite.toLowerCase()})</span>}
                      {r.fetchedAt && <p className="text-xs text-gray-300 dark:text-gray-600">{formatTimeAgo(r.fetchedAt)}</p>}
                    </td>
                    <td className="px-4 py-3 text-center"><ScoreCircle score={r.scores.performance} scoreColor={scoreColor} scoreBg={scoreBg} /></td>
                    <td className="px-4 py-3 text-center"><ScoreCircle score={r.scores.seo} scoreColor={scoreColor} scoreBg={scoreBg} /></td>
                    <td className="px-4 py-3 text-center"><ScoreCircle score={r.scores.accessibility} scoreColor={scoreColor} scoreBg={scoreBg} /></td>
                    <td className="px-4 py-3 text-center"><ScoreCircle score={r.scores.bestPractices} scoreColor={scoreColor} scoreBg={scoreBg} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ratingColor(r.webVitals.lcp?.rating || "poor")}`}>
                        {r.webVitals.lcp?.value ? `${(r.webVitals.lcp.value / 1000).toFixed(1)}s` : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ratingColor(r.webVitals.cls?.rating || "poor")}`}>
                        {r.webVitals.cls?.value !== undefined ? r.webVitals.cls.value.toFixed(3) : "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed cards per site */}
      {allUrls.filter(u => results[u]).map(url => {
        const r = results[url]!;
        const isYou = url === domain;
        return (
          <ScoreCard key={url} result={r} label={isYou ? tr.seo.pagespeed.yourSite : url} scoreColor={scoreColor} scoreBg={scoreBg} ratingColor={ratingColor} ratingLabel={ratingLabel} formatTimeAgo={formatTimeAgo} onReanalyze={() => analyzeUrl(url)} analyzing={analyzing.has(url)} highlight={isYou} />
        );
      })}
    </div>
  );
}

function ScoreCircle({ score, scoreColor, scoreBg }: { score: number; scoreColor: (s: number) => string; scoreBg: (s: number) => string }) {
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative inline-flex h-10 w-10 items-center justify-center">
      <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="2.5" className="dark:stroke-gray-700" />
        <circle cx="18" cy="18" r="16" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={scoreBg(score)} />
      </svg>
      <span className={`absolute text-xs font-bold tabular-nums ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

function ScoreCard({ result, label, scoreColor, scoreBg, ratingColor, ratingLabel, formatTimeAgo, onReanalyze, analyzing, highlight }: {
  result: PageSpeedResult; label: string;
  scoreColor: (s: number) => string; scoreBg: (s: number) => string;
  ratingColor: (r: string) => string; ratingLabel: (r: string) => string;
  formatTimeAgo: (d: string) => string; onReanalyze: () => void; analyzing: boolean; highlight?: boolean;
}) {
  const vitals = [
    { key: "lcp", label: tr.seo.pagespeed.lcp, format: (v: number) => `${(v / 1000).toFixed(1)} s` },
    { key: "fcp", label: tr.seo.pagespeed.fcp, format: (v: number) => `${(v / 1000).toFixed(1)} s` },
    { key: "cls", label: tr.seo.pagespeed.cls, format: (v: number) => v.toFixed(3) },
    { key: "inp", label: tr.seo.pagespeed.inp, format: (v: number) => `${v} ms` },
    { key: "ttfb", label: tr.seo.pagespeed.ttfb, format: (v: number) => `${v} ms` },
  ];

  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-indigo-200 bg-indigo-50/30 dark:border-indigo-800 dark:bg-indigo-900/5" : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h4>
          {result.fetchedAt && <p className="text-xs text-gray-400">{tr.seo.pagespeed.cachedAt}: {formatTimeAgo(result.fetchedAt)}</p>}
        </div>
        <button onClick={onReanalyze} disabled={analyzing} className="text-xs text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400">
          {analyzing ? tr.seo.pagespeed.analyzing : tr.seo.pagespeed.reanalyze}
        </button>
      </div>

      {/* Score circles */}
      <div className="flex items-center gap-6 mb-4">
        {([
          [tr.seo.pagespeed.performance, result.scores.performance],
          [tr.seo.pagespeed.seoScore, result.scores.seo],
          [tr.seo.pagespeed.accessibility, result.scores.accessibility],
          [tr.seo.pagespeed.bestPractices, result.scores.bestPractices],
        ] as [string, number][]).map(([lbl, score]) => (
          <div key={lbl} className="flex flex-col items-center gap-1">
            <ScoreCircle score={score} scoreColor={scoreColor} scoreBg={scoreBg} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{lbl}</span>
          </div>
        ))}
      </div>

      {/* Core Web Vitals */}
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{tr.seo.pagespeed.coreWebVitals}</h5>
      <div className="grid grid-cols-5 gap-2">
        {vitals.map(v => {
          const data = result.webVitals[v.key];
          if (!data) return null;
          return (
            <div key={v.key} className={`rounded-lg p-2 text-center ${ratingColor(data.rating)}`}>
              <p className="text-xs font-medium opacity-70">{v.label.split("(")[0].trim()}</p>
              <p className="text-sm font-bold tabular-nums">{v.format(data.value)}</p>
              <p className="text-xs opacity-70">{ratingLabel(data.rating)}</p>
            </div>
          );
        })}
      </div>

      {result.error && <p className="mt-2 text-xs text-red-500">{result.error}</p>}
    </div>
  );
}

// ---- Shared sub-components ----

function PositionBadge({ position }: { position: number }) {
  if (position <= 0) return <span className="text-xs text-gray-400">-</span>;
  let bg = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  if (position <= 3) bg = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  else if (position <= 10) bg = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  else if (position <= 20) bg = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${bg}`}>{position}</span>;
}

function ChangeBadge({ change }: { change: number }) {
  if (change === 0) return <Minus className="inline h-4 w-4 text-gray-300" />;
  if (change > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400"><ArrowUp className="h-3 w-3" />{change}</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 dark:text-red-400"><ArrowDown className="h-3 w-3" />{Math.abs(change)}</span>;
}

function KeywordDetail({ keyword, onBack }: { keyword: Keyword; onBack: () => void }) {
  const historyEntries = Object.entries(keyword.history || {}).filter(([, v]) => v > 0).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
  const positions = historyEntries.map(([, v]) => v);
  const maxPos = Math.max(...positions, 1); const minPos = Math.min(...positions, 1);
  const range = Math.max(maxPos - minPos, 1);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800/60">
        <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><ChevronLeft className="h-4 w-4" />{tr.seo.backToList}</button>
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">&quot;{keyword.keyword}&quot;</h2>
        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">{tr.seo.position}: <PositionBadge position={keyword.position} /></span>
          <span className="flex items-center gap-1">{keyword.device === "mobile" ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}{keyword.device === "mobile" ? tr.seo.mobile : tr.seo.desktop}</span>
          <span>{keyword.country?.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{tr.seo.positionHistory}</h3>
        {historyEntries.length === 0 ? <p className="text-sm text-gray-400">Henüz sıralama verisi mevcut değil. İlk tarama tamamlandığında burada görünecek.</p> : (
          <>
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <svg viewBox="0 0 800 200" className="w-full" preserveAspectRatio="xMidYMid meet">
                {[0, 0.25, 0.5, 0.75, 1].map(frac => { const y = 10 + frac * 180; return <g key={frac}><line x1="50" y1={y} x2="790" y2={y} stroke="#e5e7eb" strokeWidth="0.5" /><text x="45" y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{Math.round(minPos + frac * range)}</text></g>; })}
                {historyEntries.length > 1 && <polyline fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" points={historyEntries.map(([, pos], i) => `${50 + (i / (historyEntries.length - 1)) * 740},${10 + ((pos - minPos) / range) * 180}`).join(" ")} />}
                {historyEntries.map(([date, pos], i) => { const x = historyEntries.length > 1 ? 50 + (i / (historyEntries.length - 1)) * 740 : 420; const y = 10 + ((pos - minPos) / range) * 180; return <g key={date}><circle cx={x} cy={y} r="3" fill="#6366f1" />{(i % Math.max(1, Math.floor(historyEntries.length / 8)) === 0 || i === historyEntries.length - 1) && <text x={x} y="198" textAnchor="middle" fontSize="8" fill="#9ca3af">{new Date(date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}</text>}</g>; })}
              </svg>
            </div>
            <div className="mt-6"><table className="w-full"><thead><tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-400"><th className="px-4 py-2">Tarih</th><th className="px-4 py-2 text-center">{tr.seo.position}</th></tr></thead><tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">{[...historyEntries].reverse().slice(0, 30).map(([date, pos]) => <tr key={date}><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{new Date(date).toLocaleDateString("tr-TR")}</td><td className="px-4 py-2 text-center"><PositionBadge position={pos} /></td></tr>)}</tbody></table></div>
          </>
        )}
      </div>
    </div>
  );
}

function AddKeywordView({ domain, onBack, onAdded }: { domain: string; onBack: () => void; onAdded: () => void }) {
  const [keywordsText, setKeywordsText] = useState(""); const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [country, setCountry] = useState("TR"); const [tags, setTags] = useState(""); const [adding, setAdding] = useState(false); const [error, setError] = useState("");

  const handleAdd = async () => {
    const lines = keywordsText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setAdding(true); setError("");
    try {
      const res = await fetch("/api/seo/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keywords: lines.map(keyword => ({ keyword, device, country, domain, tags: tags.trim() || undefined })) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onAdded();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); } finally { setAdding(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800/60">
        <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><ChevronLeft className="h-4 w-4" />{tr.seo.backToList}</button>
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{tr.seo.addKeyword}</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{domain}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr.seo.keywords}</label>
          <textarea value={keywordsText} onChange={e => setKeywordsText(e.target.value)} rows={8} placeholder={tr.seo.keywordPlaceholder} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          {keywordsText.trim() && <p className="mt-1 text-xs text-gray-400">{keywordsText.split("\n").filter(l => l.trim()).length} anahtar kelime</p>}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr.seo.deviceLabel}</label><select value={device} onChange={e => setDevice(e.target.value as "desktop" | "mobile")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"><option value="desktop">{tr.seo.desktop}</option><option value="mobile">{tr.seo.mobile}</option></select></div>
          <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr.seo.countryLabel}</label><select value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"><option value="TR">Türkiye</option><option value="US">ABD</option><option value="GB">İngiltere</option><option value="DE">Almanya</option></select></div>
          <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr.seo.tags}</label><input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder={tr.seo.tagsPlaceholder} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></div>
        </div>
        <button onClick={handleAdd} disabled={adding || !keywordsText.trim()} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Plus className="h-4 w-4" />{adding ? tr.seo.adding : tr.seo.addKeywords}</button>
      </div>
    </div>
  );
}
