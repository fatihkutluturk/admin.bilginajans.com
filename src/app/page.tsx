"use client";

import { useState } from "react";
import { Sidebar, View } from "@/components/sidebar";
import { ContentList } from "@/components/content-list";
import { ContentEditor } from "@/components/content-editor";
import { TemplateList } from "@/components/template-list";
import { TemplateEditor } from "@/components/template-editor";
import { Chat } from "@/components/chat";
import { BlogWriter } from "@/components/blog-writer";
import { ContentAudit } from "@/components/content-audit";
import { SettingsPage } from "@/components/settings-page";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Home() {
  const [view, setView] = useState<View>("audit");
  const [editingId, setEditingId] = useState<number | null>(null);
  const { data: siteData } = useSWR("/api/site", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });
  const siteName = siteData?.name;
  const wpUrl = siteData?.wpUrl || "";

  const handleEdit = (id: number) => {
    setEditingId(id);
  };

  const handleBack = () => {
    setEditingId(null);
  };

  const handleNavigate = (v: View) => {
    setView(v);
    setEditingId(null);
  };

  const renderContent = () => {
    if (view === "chat") return <Chat />;
    if (view === "settings") return <SettingsPage />;
    if (view === "blog-writer") return <BlogWriter />;
    if (view === "audit") {
      return <ContentAudit onEditPage={(id) => { setView("pages"); setEditingId(id); }} />;
    }

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
