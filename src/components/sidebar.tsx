"use client";

import {
  BarChart3,
  FileText,
  PenLine,
  LayoutTemplate,
  Sparkles,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { tr } from "@/lib/tr";

export type View = "pages" | "posts" | "templates" | "blog-writer" | "audit" | "chat" | "settings";

type NavItem = {
  id: View;
  label: string;
  icon: LucideIcon;
};

const contentItems: NavItem[] = [
  { id: "audit", label: tr.nav.audit, icon: BarChart3 },
  { id: "pages", label: tr.nav.pages, icon: FileText },
  { id: "posts", label: tr.nav.posts, icon: PenLine },
  { id: "templates", label: tr.nav.templates, icon: LayoutTemplate },
];

const toolItems: NavItem[] = [
  { id: "blog-writer", label: tr.nav.blogWriter, icon: Sparkles },
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
            <BarChart3 className="h-4 w-4 text-white" />
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
