"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  PenLine,
  LayoutTemplate,
  Sparkles,
  MessageSquare,
  Settings,
  Globe,
  Search,
  TrendingUp,
  Zap,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { tr } from "@/lib/tr";

export type View = "pages" | "posts" | "templates" | "blog-writer" | "seo" | "keyword-research" | "audit" | "chat" | "settings";

type NavItem = {
  id: View;
  label: string;
  icon: LucideIcon;
};

const seoItems: NavItem[] = [
  { id: "seo", label: tr.nav.seo, icon: Globe },
  { id: "keyword-research", label: tr.nav.keywordResearch, icon: Search },
];

const contentItems: NavItem[] = [
  { id: "audit", label: tr.nav.audit, icon: ShieldCheck },
  { id: "pages", label: tr.nav.pages, icon: FileText },
  { id: "posts", label: tr.nav.posts, icon: PenLine },
  { id: "templates", label: tr.nav.templates, icon: LayoutTemplate },
  { id: "blog-writer", label: tr.nav.blogWriter, icon: Sparkles },
];

const toolItems: NavItem[] = [
  { id: "chat", label: tr.nav.chat, icon: MessageSquare },
  { id: "settings", label: tr.nav.settings, icon: Settings },
];

export function Sidebar({
  activeView,
  onNavigate,
  siteName,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  siteName?: string;
}) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r border-gray-200/80 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-950">
      {/* Brand */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
              {tr.appName}
            </h1>
            {siteName && (
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {siteName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {/* SEO section */}
        <div>
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {tr.nav.seoSection}
          </p>
          <div className="space-y-0.5">
            {seoItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeView === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </div>
        </div>

        {/* Content section */}
        <div>
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {tr.nav.content}
          </p>
          <div className="space-y-0.5">
            {contentItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeView === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </div>
        </div>

        {/* Tools section */}
        <div>
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {tr.nav.tools}
          </p>
          <div className="space-y-0.5">
            {toolItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeView === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Automation status */}
      <AutomationStatus />
    </aside>
  );
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all ${
        isActive
          ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/10 dark:text-indigo-400"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          isActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
        }`}
        strokeWidth={isActive ? 2 : 1.75}
      />
      {item.label}
    </button>
  );
}

function AutomationStatus() {
  const [status, setStatus] = useState<{ keywordCount: number; lastUpdated: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/seo/domains")
      .then(r => r.json())
      .then(async (data) => {
        const domains: Array<{ domain: string; lastUpdated?: string; updatedAt?: string }> = data.domains || [];
        if (domains.length === 0) return;
        // Fetch actual keywords for each domain to get real counts
        let totalKeywords = 0;
        let latestUpdate: string | null = null;
        for (const d of domains) {
          try {
            const kwRes = await fetch(`/api/seo/keywords?domain=${encodeURIComponent(d.domain)}`);
            const kwData = await kwRes.json();
            const kws: Array<{ lastUpdated?: string }> = kwData.keywords || [];
            totalKeywords += kws.length;
            for (const kw of kws) {
              if (kw.lastUpdated && (!latestUpdate || kw.lastUpdated > latestUpdate)) {
                latestUpdate = kw.lastUpdated;
              }
            }
          } catch { /* skip */ }
        }
        setStatus({ keywordCount: totalKeywords, lastUpdated: latestUpdate });
      })
      .catch(() => {});
  }, []);

  if (!status) return null;

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)} gün ${tr.seo.automation.ago}`;
    if (hours > 0) return `${hours} saat ${tr.seo.automation.ago}`;
    if (mins > 0) return `${mins} dakika ${tr.seo.automation.ago}`;
    return "az önce";
  };

  return (
    <div className="border-t border-gray-200/80 px-4 py-3 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs font-semibold text-green-600 dark:text-green-400">
          {tr.seo.automation.active}
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs text-gray-400 dark:text-gray-500">
        {status.lastUpdated && (
          <p>{tr.seo.automation.lastScan}: {formatTimeAgo(status.lastUpdated)}</p>
        )}
        <p>{status.keywordCount} {tr.seo.automation.trackedKeywords}</p>
        <p>{tr.seo.automation.daily}</p>
      </div>
    </div>
  );
}
