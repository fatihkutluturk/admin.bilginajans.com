import "server-only";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || (existsSync("/app/data") ? "/app/data" : process.cwd());
const UNDO_DIR = join(DATA_DIR, "undo");
const MAX_SNAPSHOTS_PER_PAGE = 10;

function ensureDir() {
  if (!existsSync(UNDO_DIR)) mkdirSync(UNDO_DIR, { recursive: true });
}

export type UndoSnapshot = {
  pageId: number;
  type: string;
  timestamp: string;
  filename: string;
};

export function saveSnapshot(pageId: number, type: string, elementorData: string): UndoSnapshot {
  ensureDir();
  const timestamp = new Date().toISOString();
  const filename = `${pageId}-${Date.now()}.json`;
  const filepath = join(UNDO_DIR, filename);

  writeFileSync(filepath, JSON.stringify({ pageId, type, timestamp, elementorData }), "utf-8");

  // Trim old snapshots
  const snapshots = listSnapshots(pageId);
  if (snapshots.length > MAX_SNAPSHOTS_PER_PAGE) {
    const toRemove = snapshots.slice(MAX_SNAPSHOTS_PER_PAGE);
    for (const snap of toRemove) {
      try { unlinkSync(join(UNDO_DIR, snap.filename)); } catch { /* ignore */ }
    }
  }

  return { pageId, type, timestamp, filename };
}

export function listSnapshots(pageId: number): UndoSnapshot[] {
  ensureDir();
  const prefix = `${pageId}-`;
  return readdirSync(UNDO_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a)) // newest first
    .map((filename) => {
      try {
        const data = JSON.parse(readFileSync(join(UNDO_DIR, filename), "utf-8"));
        return { pageId: data.pageId, type: data.type, timestamp: data.timestamp, filename };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as UndoSnapshot[];
}

export function restoreSnapshot(filename: string): { pageId: number; type: string; elementorData: string } {
  const filepath = join(UNDO_DIR, filename);
  if (!existsSync(filepath)) throw new Error("Snapshot bulunamadı");
  const data = JSON.parse(readFileSync(filepath, "utf-8"));
  return { pageId: data.pageId, type: data.type, elementorData: data.elementorData };
}
