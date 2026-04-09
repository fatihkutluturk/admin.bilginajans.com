"use client";

import { useState, FormEvent } from "react";
import { tr } from "@/lib/tr";
import { Search, X, Download } from "lucide-react";

type StockPhoto = {
  id: string;
  thumb: string;
  small: string;
  regular: string;
  full: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  width: number;
  height: number;
};

export function StockPhotoPicker({
  onSelect,
  onClose,
}: {
  onSelect: (photo: { wpMediaId: number; wpUrl: string; alt: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setMessage("");
    setPhotos([]);

    try {
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(query.trim())}&per_page=12`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.message) setMessage(data.message);
      setPhotos(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (photo: StockPhoto) => {
    setUploading(photo.id);
    setError("");

    try {
      // Upload to WordPress media library
      const res = await fetch("/api/media/upload-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: photo.regular,
          title: photo.alt || query,
          altText: photo.alt || query,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      onSelect({
        wpMediaId: data.id,
        wpUrl: data.url,
        alt: photo.alt || query,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {tr.elementorEditor.stockSearch}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr.elementorEditor.stockSearchPlaceholder}
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {searching ? tr.elementorEditor.stockSearching : tr.common.search}
          </button>
        </form>

        {/* Error / Message */}
        {error && (
          <div className="mx-5 mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {message && (
          <div className="mx-5 mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
            {message}
          </div>
        )}

        {/* Photo grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!searching && photos.length === 0 && query && (
            <p className="py-8 text-center text-sm text-gray-400">
              {tr.elementorEditor.stockNoResults}
            </p>
          )}

          {!searching && photos.length === 0 && !query && (
            <p className="py-8 text-center text-sm text-gray-400">
              {tr.elementorEditor.stockSearchPlaceholder}
            </p>
          )}

          {searching && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo) => {
              const isUploading = uploading === photo.id;
              return (
                <div
                  key={photo.id}
                  className="group relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumb}
                    alt={photo.alt}
                    className="aspect-video w-full object-cover"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <div />
                    <div className="p-3">
                      <p className="mb-2 text-xs text-white/80 line-clamp-2">
                        {photo.alt || "Unsplash"}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-white/60">
                          {photo.photographer}
                        </p>
                        <button
                          onClick={() => handleSelect(photo)}
                          disabled={isUploading}
                          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                        >
                          <Download className="h-3 w-3" />
                          {isUploading ? tr.elementorEditor.stockUploading : tr.elementorEditor.stockSelect}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Upload spinner overlay */}
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Unsplash attribution */}
        <div className="border-t border-gray-100 px-5 py-2 dark:border-gray-800">
          <p className="text-xs text-gray-400">
            Powered by{" "}
            <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">
              Unsplash
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
