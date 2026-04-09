"use client";

import { tr } from "@/lib/tr";
import useSWR from "swr";

type WPTemplate = {
  id: number;
  title: { rendered: string; raw?: string };
  status: string;
  meta: {
    _elementor_template_type?: string;
    _elementor_data?: string;
  };
};

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export function TemplateList({ onEdit }: { onEdit: (id: number) => void }) {
  const { data: templates = [], error: swrError, isLoading: loading } = useSWR<WPTemplate[]>(
    "/api/templates?per_page=50",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  const error = swrError?.message || "";

  const hasLorem = (t: WPTemplate) => t.meta?._elementor_data?.toLowerCase().includes("lorem") || false;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tr.templates.title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tr.templates.subtitle}</p>
        </div>
      </div>

      {error && <div className="px-6 py-4 text-sm text-red-600">{error}</div>}

      <div className="flex-1 overflow-y-auto">
        {templates.length === 0 && !error && (
          <div className="px-6 py-12 text-center text-sm text-gray-500">{tr.templates.noTemplates}</div>
        )}
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="px-6 py-3">{tr.templates.template}</th>
              <th className="px-6 py-3">{tr.templates.type}</th>
              <th className="px-6 py-3">{tr.templates.status}</th>
              <th className="px-6 py-3">{tr.templates.actions}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-900/50">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white" dangerouslySetInnerHTML={{ __html: t.title.rendered }} />
                    {hasLorem(t) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {tr.templates.hasDummyText}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {t.meta?._elementor_template_type || "?"}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-gray-500">{t.status}</td>
                <td className="px-6 py-3">
                  <button onClick={() => onEdit(t.id)} className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                    {tr.templates.editContent}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
