"use client";

import { tr } from "@/lib/tr";
import { useState } from "react";
import { CloneDialog } from "./clone-dialog";
import useSWR from "swr";

type WPItem = {
  id: number;
  title: { rendered: string };
  status: string;
  date: string;
  link: string;
  slug: string;
};

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export function ContentList({
  type,
  onEdit,
}: {
  type: "pages" | "posts";
  onEdit: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [cloning, setCloning] = useState<WPItem | null>(null);

  const params = new URLSearchParams({ per_page: "50" });
  if (search) params.set("search", search);

  const { data: items = [], error: swrError, isLoading: loading } = useSWR<WPItem[]>(
    `/api/${type}?${params}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const error = swrError?.message || "";

  const statusColor = (status: string) => {
    switch (status) {
      case "publish":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "pending":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "private":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {type === "pages" ? tr.nav.pages : tr.nav.posts}
        </h2>
        <input
          type="text"
          placeholder={tr.common.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          </div>
        )}

        {error && (
          <div className="px-6 py-4 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {tr.contentList.noItems(type)}
          </div>
        )}

        {!loading && !error && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-6 py-3">{tr.contentList.title}</th>
                <th className="px-6 py-3">{tr.contentList.status}</th>
                <th className="px-6 py-3">{tr.contentList.date}</th>
                <th className="px-6 py-3">{tr.contentList.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-900/50"
                >
                  <td className="px-6 py-3">
                    <div>
                      <p
                        className="text-sm font-medium text-gray-900 dark:text-white"
                        dangerouslySetInnerHTML={{
                          __html: item.title.rendered,
                        }}
                      />
                      <p className="text-xs text-gray-400">
                        /{item.slug}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(item.id)}
                        className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        {tr.common.edit}
                      </button>
                      {type === "pages" && (
                        <button
                          onClick={() => setCloning(item)}
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                        >
                          {tr.contentList.cloneWithAI}
                        </button>
                      )}
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        {tr.common.view}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {cloning && (
        <CloneDialog
          sourcePageId={cloning.id}
          sourcePageTitle={cloning.title.rendered}
          onClose={() => setCloning(null)}
          onCloned={(newPageId) => {
            setCloning(null);
            onEdit(newPageId);
          }}
        />
      )}
    </div>
  );
}
