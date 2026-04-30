"use client";

import { useState, useMemo, useCallback } from "react";
import { tr } from "@/lib/tr";
import {
  usePilotEvents,
  updatePilotEvent,
  deletePilotEvent,
  pilotEventCounts,
  usePilotProgress,
  runPilotBatch,
  PilotEvent,
  PilotEventStatus,
  AuditFixTextChange,
  AuditFixAltChange,
} from "@/lib/pilot";
import { CheckCircle2, XCircle, Clock, ImageIcon, Type, Sparkles } from "lucide-react";

type Filter = PilotEventStatus | "all";

export function ReviewQueue() {
  const events = usePilotEvents();
  const progress = usePilotProgress();
  const [filter, setFilter] = useState<Filter>("pending_review");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null);

  const counts = useMemo(() => pilotEventCounts(events), [events]);
  const isRunning = progress.status === "scanning" || progress.status === "fixing";

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.status === filter);
  }, [events, filter]);

  const apply = useCallback(async (event: PilotEvent) => {
    setBusyId(event.id);
    setErrorId(null);
    try {
      const textUpdates: Record<string, string> = {};
      for (const c of event.payload.textChanges) textUpdates[c.key] = c.after;
      const altUpdates: Record<string, string> = {};
      for (const c of event.payload.altChanges) altUpdates[c.widgetId] = c.after;

      const res = await fetch("/api/audit/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: event.payload.pageId,
          mode: "apply",
          textUpdates,
          altUpdates,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      updatePilotEvent(event.id, { status: "applied", resolvedAt: Date.now() });
    } catch (err) {
      setErrorId({ id: event.id, message: err instanceof Error ? err.message : "Apply failed" });
    } finally {
      setBusyId(null);
    }
  }, []);

  const reject = useCallback((event: PilotEvent) => {
    updatePilotEvent(event.id, { status: "rejected", resolvedAt: Date.now() });
  }, []);

  const remove = useCallback((event: PilotEvent) => {
    deletePilotEvent(event.id);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              {tr.pilot.queueTitle}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {tr.pilot.queueSubtitle}
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <CountBadge label={tr.pilot.pendingCount} count={counts.pending} tone="amber" />
            <CountBadge label={tr.pilot.appliedCount} count={counts.applied} tone="emerald" />
            <CountBadge label={tr.pilot.rejectedCount} count={counts.rejected} tone="gray" />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {(["pending_review", "applied", "rejected", "all"] as Filter[]).map((f) => {
            const labels: Record<Filter, string> = {
              pending_review: tr.pilot.filterPending,
              applied: tr.pilot.filterApplied,
              rejected: tr.pilot.filterRejected,
              all: tr.pilot.filterAll,
            };
            const count = f === "all"
              ? events.length
              : f === "pending_review" ? counts.pending
              : f === "applied" ? counts.applied
              : counts.rejected;

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                  filter === f
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800"
                }`}
              >
                {labels[f]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {isRunning ? (
              <>
                <Sparkles className="h-10 w-10 animate-pulse text-amber-500" />
                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {progress.status === "scanning"
                    ? tr.pilot.scanning
                    : tr.pilot.fixingProgress
                        .replace("{done}", String(progress.done))
                        .replace("{total}", String(progress.total))}
                </p>
                {progress.total > 0 && (
                  <div className="mt-3 h-1.5 w-64 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                )}
                {progress.currentPage && (
                  <p className="mt-2 max-w-md truncate text-xs text-gray-400">
                    {progress.currentPage}
                  </p>
                )}
              </>
            ) : (
              <>
                <Clock className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tr.pilot.empty}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr.pilot.emptyHint}</p>
                <button
                  onClick={() => runPilotBatch().catch(() => {})}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  {tr.pilot.runNow}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                busy={busyId === event.id}
                error={errorId?.id === event.id ? errorId.message : null}
                onApply={() => apply(event)}
                onReject={() => reject(event)}
                onRemove={() => remove(event)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CountBadge({ label, count, tone }: { label: string; count: number; tone: "amber" | "emerald" | "gray" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <div className={`rounded-full px-3 py-1 font-medium ${tones[tone]}`}>
      <span className="tabular-nums">{count}</span> {label}
    </div>
  );
}

function EventCard({
  event,
  busy,
  error,
  onApply,
  onReject,
  onRemove,
}: {
  event: PilotEvent;
  busy: boolean;
  error: string | null;
  onApply: () => void;
  onReject: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(event.status === "pending_review");
  const { payload, status } = event;
  const total = payload.textChanges.length + payload.altChanges.length;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4 p-4">
        <StatusIcon status={status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {payload.pageTitle || "(Başlıksız)"}
            </h3>
            <span className="text-xs text-gray-400">/{payload.pageSlug}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            {payload.textChanges.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                <Type className="h-3 w-3" /> {payload.textChanges.length} {tr.pilot.textChanges}
              </span>
            )}
            {payload.altChanges.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                <ImageIcon className="h-3 w-3" /> {payload.altChanges.length} {tr.pilot.altChanges}
              </span>
            )}
            <span className="text-gray-400">· {formatRelative(event.createdAt)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === "pending_review" ? (
            <>
              <button
                onClick={onReject}
                disabled={busy}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800"
              >
                {tr.pilot.reject}
              </button>
              <button
                onClick={onApply}
                disabled={busy || total === 0}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? tr.pilot.applying : tr.pilot.apply}
              </button>
            </>
          ) : (
            <button
              onClick={onRemove}
              className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title="Sil"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full border-t border-gray-100 px-4 py-2 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/50"
      >
        {expanded ? "Detayları gizle" : `${total} değişikliği göster`}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="space-y-3">
            {payload.textChanges.map((c) => (
              <TextDiff key={c.key} change={c} />
            ))}
            {payload.altChanges.map((c) => (
              <AltDiff key={c.widgetId} change={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: PilotEventStatus }) {
  if (status === "applied") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />;
  if (status === "rejected") return <XCircle className="h-5 w-5 shrink-0 text-gray-400" />;
  return <Clock className="h-5 w-5 shrink-0 text-amber-500" />;
}

function TextDiff({ change }: { change: AuditFixTextChange }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/30">
      <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{change.fieldLabel}</p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">{tr.pilot.before}</p>
          <p className="whitespace-pre-wrap break-words text-red-700/80 line-through decoration-red-400/40 dark:text-red-400/70">
            {change.before || "(boş)"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">{tr.pilot.after}</p>
          <p className="whitespace-pre-wrap break-words text-emerald-700 dark:text-emerald-400">
            {change.after}
          </p>
        </div>
      </div>
    </div>
  );
}

function AltDiff({ change }: { change: AuditFixAltChange }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/30">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={change.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
        <div className="min-w-0 flex-1 text-xs">
          <p className="mb-1 font-medium text-gray-500 dark:text-gray-400">Görsel alt metni</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">{tr.pilot.before}</p>
          <p className="mb-2 text-red-700/80 dark:text-red-400/70">
            {change.before || "(boş)"}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">{tr.pilot.after}</p>
          <p className="text-emerald-700 dark:text-emerald-400">{change.after}</p>
        </div>
      </div>
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
