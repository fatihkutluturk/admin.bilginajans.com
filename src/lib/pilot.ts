"use client";

import { useSyncExternalStore, useEffect } from "react";
import type { PageAudit } from "./types";

export type PilotEventStatus = "pending_review" | "applied" | "rejected";
export type PilotEventType = "audit_fix";

export type AuditFixTextChange = {
  key: string;
  fieldLabel: string;
  before: string;
  after: string;
};

export type AuditFixAltChange = {
  widgetId: string;
  imageUrl: string;
  before: string;
  after: string;
};

export type AuditFixPayload = {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  textChanges: AuditFixTextChange[];
  altChanges: AuditFixAltChange[];
};

export type PilotEvent = {
  id: string;
  type: PilotEventType;
  status: PilotEventStatus;
  createdAt: number;
  resolvedAt?: number;
  payload: AuditFixPayload;
};

const STORAGE_KEY = "wpadmin:pilot.events.v1";
const EVENT_NAME = "pilot:events-changed";
const MAX_EVENTS = 200;

function readStorage(): PilotEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PilotEvent[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(events: PilotEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* storage full — fail silently */
  }
}

export function getPilotEvents(): PilotEvent[] {
  return readStorage();
}

export function addPilotEvent(
  event: Omit<PilotEvent, "id" | "createdAt" | "status"> & { status?: PilotEventStatus }
): PilotEvent {
  const newEvent: PilotEvent = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pe_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    status: "pending_review",
    ...event,
  };
  const events = readStorage();
  events.unshift(newEvent);
  writeStorage(events);
  return newEvent;
}

export function updatePilotEvent(id: string, patch: Partial<PilotEvent>) {
  const events = readStorage();
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return;
  events[idx] = { ...events[idx], ...patch };
  writeStorage(events);
}

export function deletePilotEvent(id: string) {
  writeStorage(readStorage().filter((e) => e.id !== id));
}

const EMPTY_EVENTS: PilotEvent[] = [];
let cachedSnapshot: PilotEvent[] = EMPTY_EVENTS;
let cachedRaw: string | null = null;

function getSnapshot(): PilotEvent[] {
  if (typeof window === "undefined") return EMPTY_EVENTS;
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    cachedSnapshot = raw ? (JSON.parse(raw) as PilotEvent[]) : EMPTY_EVENTS;
  } catch {
    cachedSnapshot = EMPTY_EVENTS;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): PilotEvent[] {
  return EMPTY_EVENTS;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

export function usePilotEvents(): PilotEvent[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function pilotEventCounts(events: PilotEvent[]) {
  let pending = 0, applied = 0, rejected = 0;
  for (const e of events) {
    if (e.status === "pending_review") pending++;
    else if (e.status === "applied") applied++;
    else if (e.status === "rejected") rejected++;
  }
  return { pending, applied, rejected, total: events.length };
}

// ---- Pilot Orchestrator (batch run) ----

const LAST_RUN_KEY = "wpadmin:pilot.lastBatchRun";
const RUN_THRESHOLD_HOURS = 12;
const MAX_PAGES_PER_BATCH = 10;
const FIXABLE_CODES = new Set(["placeholder", "empty_widget", "missing_alt"]);

export type PilotRunStatus = "idle" | "scanning" | "fixing" | "done" | "error";

export type PilotProgress = {
  status: PilotRunStatus;
  total: number;
  done: number;
  currentPage?: string;
  eventsCreated: number;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
};

const IDLE_PROGRESS: PilotProgress = { status: "idle", total: 0, done: 0, eventsCreated: 0 };
let currentProgress: PilotProgress = IDLE_PROGRESS;
let activeRun: AbortController | null = null;
const progressListeners = new Set<() => void>();

function notifyProgress(p: PilotProgress) {
  currentProgress = p;
  progressListeners.forEach((l) => l());
}

function subscribeProgress(callback: () => void): () => void {
  progressListeners.add(callback);
  return () => {
    progressListeners.delete(callback);
  };
}

function getProgressSnapshot(): PilotProgress {
  return currentProgress;
}

function getServerProgressSnapshot(): PilotProgress {
  return IDLE_PROGRESS;
}

export function usePilotProgress(): PilotProgress {
  return useSyncExternalStore(subscribeProgress, getProgressSnapshot, getServerProgressSnapshot);
}

export function getLastBatchRun(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(LAST_RUN_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

export function isPilotRunning(): boolean {
  return activeRun !== null;
}

export function shouldAutoRunPilot(): boolean {
  if (isPilotRunning()) return false;
  const last = getLastBatchRun();
  if (!last) return true;
  const hoursAgo = (Date.now() - last) / 3600000;
  return hoursAgo >= RUN_THRESHOLD_HOURS;
}

export function abortPilotBatch() {
  activeRun?.abort();
}

export async function runPilotBatch(): Promise<{ eventsCreated: number }> {
  if (activeRun) {
    return { eventsCreated: 0 };
  }
  const controller = new AbortController();
  activeRun = controller;
  const startedAt = Date.now();
  let eventsCreated = 0;

  try {
    notifyProgress({ status: "scanning", total: 0, done: 0, eventsCreated: 0, startedAt });

    const auditRes = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deep: false }),
      signal: controller.signal,
    });
    if (!auditRes.ok) throw new Error(`Audit failed: ${auditRes.status}`);
    const audit = await auditRes.json();

    const fixablePages: PageAudit[] = (audit.pages || [])
      .filter((p: PageAudit) => p.issues.some((i) => FIXABLE_CODES.has(i.code)))
      .slice(0, MAX_PAGES_PER_BATCH);

    if (fixablePages.length === 0) {
      try {
        localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      notifyProgress({ status: "done", total: 0, done: 0, eventsCreated: 0, startedAt, finishedAt: Date.now() });
      return { eventsCreated: 0 };
    }

    const existingPending = new Set(
      readStorage()
        .filter((e) => e.status === "pending_review" && e.type === "audit_fix")
        .map((e) => e.payload.pageId)
    );

    notifyProgress({
      status: "fixing",
      total: fixablePages.length,
      done: 0,
      eventsCreated: 0,
      startedAt,
    });

    for (let i = 0; i < fixablePages.length; i++) {
      if (controller.signal.aborted) throw new Error("Aborted");
      const page = fixablePages[i];

      notifyProgress({
        status: "fixing",
        total: fixablePages.length,
        done: i,
        currentPage: page.title,
        eventsCreated,
        startedAt,
      });

      if (existingPending.has(page.id)) {
        continue;
      }

      try {
        const res = await fetch("/api/audit/fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: page.id, mode: "preview" }),
          signal: controller.signal,
        });
        const result = await res.json();
        if (res.ok && result.totalChanges > 0) {
          addPilotEvent({
            type: "audit_fix",
            payload: {
              pageId: result.pageId,
              pageTitle: result.pageTitle,
              pageSlug: result.pageSlug,
              textChanges: result.textChanges || [],
              altChanges: result.altChanges || [],
            },
          });
          eventsCreated++;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        // skip individual page failures
      }
    }

    try {
      localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }

    notifyProgress({
      status: "done",
      total: fixablePages.length,
      done: fixablePages.length,
      eventsCreated,
      startedAt,
      finishedAt: Date.now(),
    });
    return { eventsCreated };
  } catch (err) {
    notifyProgress({
      status: "error",
      total: currentProgress.total,
      done: currentProgress.done,
      eventsCreated,
      error: err instanceof Error ? err.message : "Unknown",
      startedAt,
      finishedAt: Date.now(),
    });
    throw err;
  } finally {
    activeRun = null;
  }
}

/**
 * Mount-once auto-run trigger. Fires runPilotBatch() if last run > 12h ago.
 * Safe to mount multiple times — the orchestrator no-ops when already running.
 */
export function usePilotAutoRun(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (!shouldAutoRunPilot()) return;
    // Defer to next tick so initial render isn't blocked
    const t = window.setTimeout(() => {
      runPilotBatch().catch(() => {
        /* errors surface via progress.status === "error" */
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [enabled]);
}


