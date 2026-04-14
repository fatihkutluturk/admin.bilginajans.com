"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar, View } from "@/components/sidebar";
import { ContentList } from "@/components/content-list";
import { ContentEditor } from "@/components/content-editor";
import { TemplateList } from "@/components/template-list";
import { TemplateEditor } from "@/components/template-editor";
import { BlogWriter } from "@/components/blog-writer";
import { SettingsPage } from "@/components/settings-page";
import { SeoDashboard } from "@/components/seo-dashboard";
import { KeywordResearch } from "@/components/keyword-research";
import { ContentAudit } from "@/components/content-audit";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const VALID_VIEWS: View[] = ["seo", "keyword-research", "audit", "pages", "posts", "templates", "blog-writer", "settings"];

function parseHash(): { view: View; editId: number | null } {
  if (typeof window === "undefined") return { view: "seo", editId: null };
  const hash = window.location.hash.replace("#", "");
  if (!hash) return { view: "seo", editId: null };
  const parts = hash.split("/");
  const view = (VALID_VIEWS.includes(parts[0] as View) ? parts[0] : "seo") as View;
  const editId = parts[1] ? Number(parts[1]) || null : null;
  return { view, editId };
}

export default function Home() {
  const [view, setView] = useState<View>("seo");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const { data: siteData } = useSWR("/api/site", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });
  const siteName = siteData?.name;
  const wpUrl = siteData?.wpUrl || "";

  // Sync from hash on mount and popstate
  useEffect(() => {
    const { view: v, editId } = parseHash();
    setView(v);
    setEditingId(editId);
    setMounted(true);

    const onPopState = () => {
      const { view: v2, editId: e2 } = parseHash();
      setView(v2);
      setEditingId(e2);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Sync hash when view/editingId change (after mount)
  useEffect(() => {
    if (!mounted) return;
    const hash = editingId ? `${view}/${editingId}` : view;
    if (window.location.hash !== `#${hash}`) {
      window.history.pushState(null, "", `#${hash}`);
    }
  }, [view, editingId, mounted]);

  const handleEdit = useCallback((id: number) => {
    setEditingId(id);
  }, []);

  const handleBack = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleNavigate = useCallback((v: View) => {
    setView(v);
    setEditingId(null);
  }, []);

  const renderContent = () => {
    if (view === "settings") return <SettingsPage />;
    if (view === "blog-writer") return <BlogWriter />;
    if (view === "audit") return <ContentAudit onEditPage={(id) => { handleNavigate("pages"); setEditingId(id); }} />;
    if (view === "keyword-research") return <KeywordResearch onNavigate={handleNavigate} />;
    if (view === "seo") return <SeoDashboard onNavigateSettings={() => handleNavigate("settings")} />;

    if (view === "templates") {
      if (editingId) {
        return <TemplateEditor id={editingId} onBack={handleBack} />;
      }
      return <TemplateList onEdit={handleEdit} />;
    }

    // pages or posts
    if (editingId) {
      return <ContentEditor type={view} id={editingId} onBack={handleBack} wpUrl={wpUrl} />;
    }
    return <ContentList type={view} onEdit={handleEdit} />;
  };

  return (
    <div className="flex h-screen">
      <Sidebar activeView={view} onNavigate={handleNavigate} siteName={siteName} />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
