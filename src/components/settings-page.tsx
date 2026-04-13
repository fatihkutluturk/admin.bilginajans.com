"use client";

import { useState, useEffect, useCallback } from "react";
import { tr } from "@/lib/tr";
import { PromptConfig } from "@/lib/prompt-defaults";
import { RotateCcw, Save, ChevronDown, ChevronRight, Lock } from "lucide-react";

type PromptSection = {
  id: keyof PromptConfig;
  title: string;
  description: string;
  fields: { key: string; label: string; rows: number }[];
  lockedPreview: string;
};

const SECTIONS: PromptSection[] = [
  {
    id: "chat",
    title: tr.settings.chatPrompt,
    description: tr.settings.chatPromptDesc,
    fields: [
      { key: "role", label: tr.settings.role, rows: 4 },
      { key: "guidelines", label: tr.settings.guidelines, rows: 6 },
    ],
    lockedPreview: `IMPORTANT - Resolving names to IDs:
- When a user refers to a post or page by name/title/slug instead of ID, you MUST first use the search parameter...
- NEVER ask the user for an ID — look it up yourself.
- Always chain these lookups automatically without asking the user.`,
  },
  {
    id: "elementorContent",
    title: tr.settings.elementorPrompt,
    description: tr.settings.elementorPromptDesc,
    fields: [
      { key: "role", label: tr.settings.role, rows: 2 },
      { key: "contentRules", label: tr.settings.contentRules, rows: 5 },
      { key: "seoGuidance", label: tr.settings.seoGuidance, rows: 5 },
    ],
    lockedPreview: `Field format rules (Heading=plain text, Text=HTML tags, Button=1-3 words...)
SEO Heading Hierarchy (ONE H1, H2 for sections, H3 for subsections)
JSON return format: { widgets: [{ widgetId, text }] }`,
  },
  {
    id: "altText",
    title: tr.settings.altTextPrompt,
    description: tr.settings.altTextPromptDesc,
    fields: [
      { key: "role", label: tr.settings.role, rows: 2 },
      { key: "guidance", label: tr.settings.guidance, rows: 4 },
    ],
    lockedPreview: `Alt text length: 10-20 words
JSON return format: { images: [{ widgetId, altText }] }`,
  },
  {
    id: "contentIdeas",
    title: tr.settings.contentIdeasPrompt,
    description: tr.settings.contentIdeasPromptDesc,
    fields: [
      { key: "role", label: tr.settings.role, rows: 4 },
      { key: "focusAreas", label: tr.settings.focusAreas, rows: 5 },
      { key: "ideaCount", label: tr.settings.ideaCount, rows: 1 },
    ],
    lockedPreview: `Required fields: title, contentType, targetKeyword, searchVolumeHint, description, alignment, suggestedTemplateType
contentType enum: "blog", "service", "landing", "about", "faq", "other"
ID format: idea-1, idea-2, etc.
JSON schema enforced by Gemini structured output`,
  },
];

export function SettingsPage() {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [defaults, setDefaults] = useState<PromptConfig | null>(null);
  const [apiKeys, setApiKeys] = useState<{ geminiApiKey: string; unsplashAccessKey: string }>({ geminiApiKey: "", unsplashAccessKey: "" });
  const [wordpress, setWordpress] = useState<{ url: string; username: string; appPassword: string }>({ url: "", username: "", appPassword: "" });
  const [serpbear, setSerpbear] = useState<{ url: string; apiKey: string; username: string; password: string }>({ url: "", apiKey: "", username: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [expandedLocked, setExpandedLocked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/settings/prompts")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        setDefaults(data.defaults);
        if (data.apiKeys) setApiKeys(data.apiKeys);
        if (data.wordpress) setWordpress(data.wordpress);
        if (data.serpbear) setSerpbear(data.serpbear);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/settings/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, apiKeys, wordpress, serpbear }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess(tr.settings.saved);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [config, apiKeys, wordpress, serpbear]);

  const handleReset = useCallback(
    (sectionId: keyof PromptConfig) => {
      if (!defaults || !config) return;
      if (!confirm(tr.settings.resetConfirm)) return;
      setConfig({ ...config, [sectionId]: { ...defaults[sectionId] } });
    },
    [config, defaults]
  );

  const updateField = useCallback(
    (sectionId: keyof PromptConfig, fieldKey: string, value: string) => {
      if (!config) return;
      setConfig({
        ...config,
        [sectionId]: { ...config[sectionId], [fieldKey]: value },
      });
    },
    [config]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="px-6 py-4 text-sm text-red-600">{error || "Failed to load settings"}</div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800/60">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            {tr.settings.title}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {tr.settings.subtitle}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? tr.common.saving : tr.settings.save}
        </button>
      </div>

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

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* WordPress Connection */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            {tr.settings.wpConnection}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{tr.settings.siteUrl}</label>
              <input
                type="url"
                value={wordpress.url}
                onChange={(e) => setWordpress((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{tr.settings.username}</label>
                <input
                  type="text"
                  value={wordpress.username}
                  onChange={(e) => setWordpress((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="admin"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{tr.settings.appPassword}</label>
                <input
                  type="password"
                  value={wordpress.appPassword}
                  onChange={(e) => setWordpress((prev) => ({ ...prev, appPassword: e.target.value }))}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">{tr.settings.wpHelp}</p>
          </div>
        </div>

        {/* API Keys */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            {tr.settings.apiKeysSection}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {tr.settings.geminiKey}
              </label>
              <input
                type="password"
                value={apiKeys.geminiApiKey}
                onChange={(e) => setApiKeys((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                placeholder="AIza..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-400">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">Google AI Studio</a>&#39;dan {tr.settings.geminiHelp.split("ücretsiz")[0]}ücretsiz alabilirsiniz
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {tr.settings.unsplashKey}
              </label>
              <input
                type="password"
                value={apiKeys.unsplashAccessKey}
                onChange={(e) => setApiKeys((prev) => ({ ...prev, unsplashAccessKey: e.target.value }))}
                placeholder={`${tr.settings.optional} — stok fotoğraf araması için`}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-400">
                <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">Unsplash Developers</a>&#39;dan {tr.settings.unsplashHelp.split("ücretsiz")[0]}ücretsiz alabilirsiniz
              </p>
            </div>
          </div>
        </div>

        {/* SerpBear */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            {tr.settings.serpbearSection}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {tr.settings.serpbearUrl}
              </label>
              <input
                type="url"
                value={serpbear.url}
                onChange={(e) => setSerpbear((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://seo.alanadi.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {tr.settings.serpbearApiKey}
              </label>
              <input
                type="password"
                value={serpbear.apiKey}
                onChange={(e) => setSerpbear((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="SerpBear APIKEY değeri"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {tr.settings.serpbearUsername}
                </label>
                <input
                  type="text"
                  value={serpbear.username}
                  onChange={(e) => setSerpbear((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="admin"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {tr.settings.serpbearPassword}
                </label>
                <input
                  type="password"
                  value={serpbear.password}
                  onChange={(e) => setSerpbear((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="SerpBear giriş şifresi"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">{tr.settings.serpbearHelp}</p>
          </div>
        </div>

        {/* Prompt sections */}
        {SECTIONS.map((section) => {
          const sectionConfig = config[section.id] as Record<string, string>;
          const isLockedExpanded = expandedLocked[section.id];

          return (
            <div
              key={section.id}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              {/* Section header */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {section.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {section.description}
                  </p>
                </div>
                <button
                  onClick={() => handleReset(section.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="h-3 w-3" />
                  {tr.settings.resetToDefault}
                </button>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                {section.fields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {tr.settings.editableSection}
                      </span>
                      {field.label}
                    </label>
                    {field.rows === 1 ? (
                      <input
                        type="text"
                        value={sectionConfig[field.key] || ""}
                        onChange={(e) => updateField(section.id, field.key, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <textarea
                        value={sectionConfig[field.key] || ""}
                        onChange={(e) => updateField(section.id, field.key, e.target.value)}
                        rows={field.rows}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Locked section (collapsible) */}
              <div className="mt-3">
                <button
                  onClick={() =>
                    setExpandedLocked((prev) => ({
                      ...prev,
                      [section.id]: !prev[section.id],
                    }))
                  }
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {isLockedExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Lock className="h-3 w-3" />
                  {tr.settings.lockedSection}
                </button>
                {isLockedExpanded && (
                  <pre className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400 whitespace-pre-wrap">
                    {section.lockedPreview}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
