"use client";

import { useEffect, useState, useCallback } from "react";
import { ExtractedWidget, ExtractedImage } from "@/lib/types";
import { Image as ImageIcon, AlertTriangle, Search } from "lucide-react";
import { tr } from "@/lib/tr";
import useSWR from "swr";
import { StockPhotoPicker } from "./stock-photo-picker";

export function ElementorEditor({
  pageId,
  type,
  initialBrief,
}: {
  pageId: number;
  type: "pages" | "posts" | "templates";
  initialBrief?: string;
}) {
  const [widgets, setWidgets] = useState<ExtractedWidget[]>([]);
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingWidget, setGeneratingWidget] = useState<string | null>(null);
  const [brief, setBrief] = useState(initialBrief || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [editedAlts, setEditedAlts] = useState<Record<string, string>>({});
  const [editedImageUrls, setEditedImageUrls] = useState<Record<string, { url: string; id: number }>>({});
  const [generatingAlts, setGeneratingAlts] = useState(false);
  const [stockPickerForWidget, setStockPickerForWidget] = useState<string | null>(null);

  const swrFetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  const { data: swrData, isLoading: loading } = useSWR(
    `/api/${type}/${pageId}/elementor`,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  useEffect(() => {
    if (swrData && !initialized) {
      setWidgets(swrData.widgets);
      setPageTitle(swrData.title);
      const texts: Record<string, string> = {};
      swrData.widgets.forEach((w: ExtractedWidget) => {
        texts[w.key] = w.currentText;
      });
      setEditedTexts(texts);
      // Images
      if (swrData.images) {
        setImages(swrData.images);
        const alts: Record<string, string> = {};
        swrData.images.forEach((img: ExtractedImage) => {
          alts[img.widgetId] = img.altText;
        });
        setEditedAlts(alts);
      }
      setInitialized(true);
    }
  }, [swrData, initialized]);

  const handleGenerateAll = useCallback(async () => {
    if (!brief.trim()) {
      setError(tr.elementorEditor.briefRequired);
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/elementor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          widgets: widgets.map((w) => ({
            widgetId: w.key,
            widgetType: w.widgetType,
            sectionIndex: w.sectionIndex,
            currentText: editedTexts[w.key] || w.currentText,
            fieldLabel: w.fieldLabel,
          })),
          language: "tr",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const newTexts = { ...editedTexts };
      for (const item of data.widgets) {
        if (newTexts[item.widgetId] !== undefined) {
          newTexts[item.widgetId] = item.text;
        }
      }
      setEditedTexts(newTexts);
      setSuccess(tr.elementorEditor.contentGenerated);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [brief, widgets, editedTexts]);

  const handleGenerateOne = useCallback(
    async (widget: ExtractedWidget) => {
      if (!brief.trim()) {
        setError(tr.elementorEditor.briefRequired);
        return;
      }
      setGeneratingWidget(widget.key);
      setError("");
      try {
        const res = await fetch("/api/elementor/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief,
            widgets: [
              {
                widgetId: widget.key,
                widgetType: widget.widgetType,
                sectionIndex: widget.sectionIndex,
                currentText: editedTexts[widget.key] || widget.currentText,
                fieldLabel: widget.fieldLabel,
              },
            ],
            language: "tr",
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.widgets?.[0]) {
          setEditedTexts((prev) => ({
            ...prev,
            [data.widgets[0].widgetId]: data.widgets[0].text,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setGeneratingWidget(null);
      }
    },
    [brief, editedTexts]
  );

  const handleGenerateAlts = useCallback(async () => {
    if (images.length === 0) return;
    setGeneratingAlts(true);
    setError("");
    try {
      const res = await fetch("/api/elementor/generate-alt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img) => ({ widgetId: img.widgetId, imageUrl: img.imageUrl })),
          pageBrief: brief || pageTitle,
          language: "tr",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newAlts = { ...editedAlts };
      for (const item of data.images) {
        if (newAlts[item.widgetId] !== undefined) {
          newAlts[item.widgetId] = item.altText;
        }
      }
      setEditedAlts(newAlts);
      setSuccess(tr.elementorEditor.altGenerated);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Alt text generation failed");
    } finally {
      setGeneratingAlts(false);
    }
  }, [images, editedAlts, brief, pageTitle]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    // Only send widgets that were actually changed
    const updates: Record<string, string> = {};
    for (const w of widgets) {
      if (editedTexts[w.key] !== w.currentText) {
        updates[w.key] = editedTexts[w.key];
      }
    }

    // Image alt updates
    const imageAltUpdates: Record<string, string> = {};
    for (const img of images) {
      if (editedAlts[img.widgetId] !== img.altText) {
        imageAltUpdates[img.widgetId] = editedAlts[img.widgetId];
      }
    }

    // Image URL replacements (from stock photos)
    const imageUrlUpdates = Object.keys(editedImageUrls).length > 0 ? editedImageUrls : undefined;

    const hasChanges = Object.keys(updates).length > 0 || Object.keys(imageAltUpdates).length > 0 || imageUrlUpdates;
    if (!hasChanges) {
      setError(tr.elementorEditor.noChanges);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/${type}/${pageId}/elementor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: Object.keys(updates).length > 0 ? updates : undefined,
          imageAltUpdates: Object.keys(imageAltUpdates).length > 0 ? imageAltUpdates : undefined,
          imageUrlUpdates,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuccess(tr.elementorEditor.savedWidgets(data.updatedWidgets));

      // Update the "original" text so changed detection resets
      setWidgets((prev) =>
        prev.map((w) =>
          updates[w.key] !== undefined
            ? { ...w, currentText: updates[w.key] }
            : w
        )
      );
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [widgets, editedTexts, images, editedAlts, type, pageId]);

  const changedTextCount = widgets.filter(
    (w) => editedTexts[w.key] !== w.currentText
  ).length;
  const changedAltCount = images.filter(
    (img) => editedAlts[img.widgetId] !== img.altText
  ).length;
  const changedCount = changedTextCount + changedAltCount;

  const fieldBadgeColor = (widgetType: string, headingTag?: string) => {
    if (widgetType === "heading" && headingTag === "h1") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
    switch (widgetType) {
      case "heading":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "text-editor":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "button":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "icon-box":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "counter":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  // Determine if widget should use single-line input or textarea
  const isShortField = (w: ExtractedWidget) =>
    w.widgetType === "heading" ||
    w.widgetType === "button" ||
    w.widgetType === "counter" ||
    w.fieldKey === "title_text" ||
    w.fieldKey === "title" ||
    w.fieldKey === "heading" ||
    w.fieldKey === "sub_heading" ||
    w.fieldKey === "button_text" ||
    w.fieldKey === "text";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  if (widgets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-medium text-gray-400">
          {tr.elementorEditor.noWidgets}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {tr.elementorEditor.noWidgetsDesc}
        </p>
      </div>
    );
  }

  // Group by section
  const sections = new Map<number, ExtractedWidget[]>();
  for (const w of widgets) {
    if (!sections.has(w.sectionIndex)) sections.set(w.sectionIndex, []);
    sections.get(w.sectionIndex)!.push(w);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="space-y-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Elementor İçerik — {pageTitle}
            </h3>
            <p className="text-xs text-gray-500">
              {tr.elementorEditor.textFields(widgets.length)}
              {changedCount > 0 && (
                <span className="ml-2 text-amber-600">
                  {tr.elementorEditor.unsavedChanges(changedCount)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || changedCount === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? tr.common.saving : tr.elementorEditor.saveToWP}
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={tr.elementorEditor.briefPlaceholder}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button
            onClick={handleGenerateAll}
            disabled={generating || !brief.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {generating ? tr.common.generating : tr.elementorEditor.generateAll}
          </button>
        </div>
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

      {/* Widget cards */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {Array.from(sections.entries()).map(([sectionIdx, sectionWidgets]) => (
          <div key={sectionIdx}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {tr.elementorEditor.section} {sectionIdx}
            </h4>
            <div className="space-y-3">
              {sectionWidgets.map((w) => {
                const isChanged = editedTexts[w.key] !== w.currentText;
                const isGeneratingThis = generatingWidget === w.key;

                return (
                  <div
                    key={w.key}
                    className={`rounded-xl border p-4 ${
                      w.isPlaceholder
                        ? "border-amber-300 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20"
                        : isChanged
                          ? "border-indigo-300 bg-indigo-50/30 dark:border-indigo-600 dark:bg-indigo-950/20"
                          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${fieldBadgeColor(w.widgetType, w.headingTag)}`}
                        >
                          {w.fieldLabel}
                        </span>
                        {w.isPlaceholder && (
                          <span className="text-xs text-amber-600">
                            {tr.elementorEditor.placeholder}
                          </span>
                        )}
                        {isChanged && (
                          <span className="text-xs text-indigo-600">
                            {tr.elementorEditor.modified}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleGenerateOne(w)}
                        disabled={isGeneratingThis || !brief.trim()}
                        className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-400"
                      >
                        {isGeneratingThis ? "..." : tr.common.generate}
                      </button>
                    </div>

                    {isShortField(w) ? (
                      <input
                        type="text"
                        value={editedTexts[w.key] || ""}
                        onChange={(e) =>
                          setEditedTexts((prev) => ({
                            ...prev,
                            [w.key]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <textarea
                        value={editedTexts[w.key] || ""}
                        onChange={(e) =>
                          setEditedTexts((prev) => ({
                            ...prev,
                            [w.key]: e.target.value,
                          }))
                        }
                        rows={6}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Images section */}
        {images.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <ImageIcon className="h-4 w-4" />
                {tr.elementorEditor.images} ({tr.elementorEditor.imageCount(images.length)})
              </h4>
              <button
                onClick={handleGenerateAlts}
                disabled={generatingAlts}
                className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                {generatingAlts ? tr.common.generating : tr.elementorEditor.generateAllAlts}
              </button>
            </div>
            <div className="space-y-3">
              {images.map((img) => {
                const altChanged = editedAlts[img.widgetId] !== img.altText;
                const replacedUrl = editedImageUrls[img.widgetId];
                const displayUrl = replacedUrl?.url || img.imageUrl;

                return (
                  <div
                    key={img.widgetId}
                    className={`flex gap-4 rounded-xl border p-3 ${
                      replacedUrl
                        ? "border-green-300 bg-green-50/30 dark:border-green-600 dark:bg-green-950/20"
                        : img.isPlaceholder
                          ? "border-amber-300 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20"
                          : altChanged
                            ? "border-indigo-300 bg-indigo-50/30 dark:border-indigo-600 dark:bg-indigo-950/20"
                            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayUrl}
                        alt={editedAlts[img.widgetId] || ""}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>

                    {/* Info + alt input + stock photo button */}
                    <div className="flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
                          {img.widgetType}
                        </span>
                        {!editedAlts[img.widgetId]?.trim() && (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {tr.elementorEditor.missingAlt}
                          </span>
                        )}
                        {replacedUrl && (
                          <span className="text-xs text-green-600">{tr.elementorEditor.stockUploaded}</span>
                        )}
                        {altChanged && !replacedUrl && (
                          <span className="text-xs text-indigo-600">{tr.elementorEditor.modified}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editedAlts[img.widgetId] || ""}
                          onChange={(e) =>
                            setEditedAlts((prev) => ({
                              ...prev,
                              [img.widgetId]: e.target.value,
                            }))
                          }
                          placeholder={tr.elementorEditor.altText}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <button
                          onClick={() => setStockPickerForWidget(img.widgetId)}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          <Search className="h-3 w-3" />
                          {tr.elementorEditor.stockSearch}
                        </button>
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-400">
                        {displayUrl.split("/").pop()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stock photo picker modal */}
        {stockPickerForWidget && (
          <StockPhotoPicker
            onSelect={(photo) => {
              setEditedImageUrls((prev) => ({
                ...prev,
                [stockPickerForWidget]: { url: photo.wpUrl, id: photo.wpMediaId },
              }));
              setEditedAlts((prev) => ({
                ...prev,
                [stockPickerForWidget]: photo.alt || prev[stockPickerForWidget] || "",
              }));
              setStockPickerForWidget(null);
            }}
            onClose={() => setStockPickerForWidget(null)}
          />
        )}
      </div>
    </div>
  );
}
