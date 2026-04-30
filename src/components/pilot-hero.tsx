"use client";

import { useMemo, useState } from "react";
import { Sparkles, Clock, ArrowRight } from "lucide-react";
import {
  usePilotEvents,
  usePilotProgress,
  pilotEventCounts,
  runPilotBatch,
  abortPilotBatch,
  getLastBatchRun,
} from "@/lib/pilot";
import { tr } from "@/lib/tr";

export function PilotHero({ onOpenQueue }: { onOpenQueue: () => void }) {
  const events = usePilotEvents();
  const progress = usePilotProgress();
  const counts = useMemo(() => pilotEventCounts(events), [events]);
  const isRunning = progress.status === "scanning" || progress.status === "fixing";
  const lastRunAt = getLastBatchRun();
  const [mountedAt] = useState(() => Date.now());

  const recent = useMemo(() => {
    const cutoff = mountedAt - 24 * 3600 * 1000;
    return events.filter((e) => e.createdAt >= cutoff);
  }, [events, mountedAt]);

  return (
    <div className="mx-6 mt-4 overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 via-white to-amber-50 shadow-sm dark:border-indigo-500/20 dark:from-indigo-950/30 dark:via-gray-900 dark:to-amber-950/20">
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className={`h-5 w-5 ${isRunning ? "animate-pulse" : ""}`} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            {tr.pilot.heroTitle}
          </h3>

          {isRunning ? (
            <RunningBody progress={progress} />
          ) : recent.length > 0 ? (
            <SummaryBody
              recentCount={recent.length}
              pending={counts.pending}
              applied={counts.applied}
              lastRunAt={lastRunAt}
              onOpenQueue={onOpenQueue}
            />
          ) : (
            <EmptyBody lastRunAt={lastRunAt} />
          )}
        </div>

        {!isRunning && (
          <button
            onClick={() => runPilotBatch().catch(() => {})}
            className="shrink-0 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            {tr.pilot.runNow}
          </button>
        )}
        {isRunning && (
          <button
            onClick={() => abortPilotBatch()}
            className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700"
          >
            {tr.pilot.abort}
          </button>
        )}
      </div>
    </div>
  );
}

function RunningBody({ progress }: { progress: ReturnType<typeof usePilotProgress> }) {
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  return (
    <div className="mt-1.5 space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {progress.status === "scanning"
          ? tr.pilot.scanning
          : tr.pilot.fixingProgress
              .replace("{done}", String(progress.done))
              .replace("{total}", String(progress.total))}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.currentPage && (
        <p className="truncate text-xs text-gray-400 dark:text-gray-500">{progress.currentPage}</p>
      )}
    </div>
  );
}

function SummaryBody({
  recentCount,
  pending,
  applied,
  lastRunAt,
  onOpenQueue,
}: {
  recentCount: number;
  pending: number;
  applied: number;
  lastRunAt: number;
  onOpenQueue: () => void;
}) {
  return (
    <div className="mt-1.5 space-y-2.5">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {tr.pilot.heroSummary
          .replace("{pages}", String(recentCount))
          .replace("{events}", String(applied + pending))}
      </p>
      {lastRunAt > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Clock className="h-3 w-3" />
          {tr.pilot.heroLastRun}: {formatRelative(lastRunAt)}
        </p>
      )}
      {pending > 0 ? (
        <button
          onClick={onOpenQueue}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
        >
          {tr.pilot.heroPendingCta.replace("{count}", String(pending))}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">{tr.pilot.heroNoPending}</p>
      )}
    </div>
  );
}

function EmptyBody({ lastRunAt }: { lastRunAt: number }) {
  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-sm text-gray-600 dark:text-gray-300">{tr.pilot.heroEmpty}</p>
      {lastRunAt > 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {tr.pilot.heroLastRun}: {formatRelative(lastRunAt)}
        </p>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">{tr.pilot.heroNever}</p>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}
