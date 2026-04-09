"use client";

import { PendingAction } from "@/lib/types";
import { tr } from "@/lib/tr";

export function ConfirmationCard({
  action,
  onApprove,
  onReject,
  isLoading,
}: {
  action: PendingAction;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 dark:border-amber-500 dark:bg-amber-950">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          {tr.chat.confirmationRequired}
        </p>
        <p className="mb-3 text-sm text-gray-900 dark:text-gray-100">
          {action.summary}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {tr.common.approve}
          </button>
          <button
            onClick={onReject}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {tr.common.reject}
          </button>
        </div>
      </div>
    </div>
  );
}
