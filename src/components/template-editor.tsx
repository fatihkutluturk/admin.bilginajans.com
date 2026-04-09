"use client";

import { tr } from "@/lib/tr";
import { ElementorEditor } from "./elementor-editor";

export function TemplateEditor({ id, onBack }: { id: number; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <button onClick={onBack} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
          {tr.common.back}
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {tr.templates.editTemplate(id)}
        </h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <ElementorEditor pageId={id} type="templates" />
      </div>
    </div>
  );
}
