"use client";

import { useEffect, useState, useCallback } from "react";
import { EditorAIChat } from "./editor-ai-chat";
import { ElementorEditor } from "./elementor-editor";
import { tr } from "@/lib/tr";

type WPContent = {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  status: string;
  slug: string;
  link: string;
};

type Tab = "fields" | "elementor";

export function ContentEditor({
  type,
  id,
  onBack,
}: {
  type: "pages" | "posts";
  id: number;
  onBack: () => void;
}) {
  const [item, setItem] = useState<WPContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("elementor");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState("draft");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/${type}/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: WPContent) => {
        setItem(data);
        setTitle(data.title.rendered);
        setContent(data.content.rendered);
        setExcerpt(data.excerpt.rendered);
        setStatus(data.status);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [type, id]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/${type}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, excerpt, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess("Saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyFields = useCallback(
    (fields: Partial<{ title: string; content: string; excerpt: string }>) => {
      if (fields.title !== undefined) setTitle(fields.title);
      if (fields.content !== undefined) setContent(fields.content);
      if (fields.excerpt !== undefined) setExcerpt(fields.excerpt);
    },
    []
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="px-6 py-4 text-sm text-red-600">
        {error || "Item not found"}
      </div>
    );
  }

  const wpEditUrl = `${process.env.NEXT_PUBLIC_WP_URL || ""}/wp-admin/post.php?post=${id}&action=edit`;
  const elementorUrl = `${process.env.NEXT_PUBLIC_WP_URL || ""}/wp-admin/post.php?post=${id}&action=elementor`;

  return (
    <div className="flex h-full">
      {/* Main panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {tr.common.back}
            </button>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              #{id}
            </h2>

            {/* Tabs */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("elementor")}
                className={`px-3 py-1 text-xs font-medium ${
                  activeTab === "elementor"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                } rounded-l-lg`}
              >
                {tr.editor.elementorContent}
              </button>
              <button
                onClick={() => setActiveTab("fields")}
                className={`px-3 py-1 text-xs font-medium ${
                  activeTab === "fields"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                } rounded-r-lg`}
              >
                {tr.editor.fields}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={elementorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
            >
              {tr.editor.elementor}
            </a>
            <a
              href={wpEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {tr.editor.wpEditor}
            </a>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "elementor" ? (
          <ElementorEditor pageId={id} type={type} />
        ) : (
          <>
            {/* Feedback */}
            {error && (
              <div className="mx-6 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="mx-6 mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                {success}
              </div>
            )}

            {/* Fields form */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {tr.editor.title}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {tr.editor.statusLabel}
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="publish">{tr.status.publish}</option>
                      <option value="draft">{tr.status.draft}</option>
                      <option value="pending">{tr.status.pending}</option>
                      <option value="private">{tr.status.private}</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="self-end rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? tr.common.saving : tr.common.save}
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr.editor.contentHtml}
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={14}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr.editor.excerpt}
                  </label>
                  <textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr.editor.preview}
                  </label>
                  <div
                    className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-950"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                </div>
              </div>

              {/* AI Chat panel (fields tab only) */}
              <div className="w-80 shrink-0">
                <EditorAIChat
                  pageId={id}
                  pageType={type}
                  fields={{ title, content, excerpt }}
                  onApplyFields={handleApplyFields}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
