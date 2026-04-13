# Chat Loop Fix & Undo System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the chat tool-calling loop so write tools don't break the read→reason→write chain, and add an undo system for Elementor edits.

**Architecture:** The chat loop currently breaks when Gemini calls a write tool — it sends a confirmation and stops. The fix queues write tools with a synthetic "pending approval" response back to Gemini, lets it finish reasoning, then presents all queued writes as a batch confirmation. Undo snapshots Elementor JSON before writes to a server-side data directory.

**Tech Stack:** Next.js 16 App Router, Gemini API (@google/genai), TypeScript, server-side file storage for undo.

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `src/lib/types.ts` | Shared types for PendingAction batch | Modify |
| `src/app/api/chat/route.ts` | Chat loop — the core fix | Modify |
| `src/hooks/use-chat.ts` | Client-side batch approval flow | Modify |
| `src/components/confirmation-card.tsx` | Batch preview UI | Modify |
| `src/lib/undo.ts` | Undo snapshot save/restore/list | Create |
| `src/app/api/elementor/undo/route.ts` | Undo REST endpoints | Create |

---

### Task 1: Update PendingAction type for batch writes

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update PendingAction type to support batch writes**

In `src/lib/types.ts`, change the `PendingAction` type and add `BatchPendingAction`:

```typescript
// Replace the existing PendingAction:
export type PendingAction = {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
  summary: string;
};

// With:
export type QueuedWrite = {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
  summary: string;
};

export type PendingAction = {
  writes: QueuedWrite[];
  combinedSummary: string;
};
```

Also update the `StreamChunk` type — the `confirmation` variant now sends the new shape:

```typescript
export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "confirmation"; pendingAction: PendingAction }
  | { type: "result"; content: string }
  | { type: "error"; content: string };
```

(StreamChunk doesn't change — it already uses `PendingAction`. The type flows through.)

- [ ] **Step 2: Verify no TypeScript errors from the type change**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: Errors in `chat/route.ts`, `use-chat.ts`, `confirmation-card.tsx` because they use the old `PendingAction` shape. This is expected — we fix them in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "refactor: update PendingAction type for batch write support"
```

---

### Task 2: Fix the chat loop to queue writes instead of breaking

**Files:**
- Modify: `src/app/api/chat/route.ts`

This is the core fix. The loop currently does `if (WRITE_TOOL) → send confirmation, break`. We change it to queue the write and continue.

- [ ] **Step 1: Rewrite the normal chat flow section**

Replace the entire `// --- Normal chat flow ---` section (lines 97-204) in `src/app/api/chat/route.ts` with:

```typescript
        // --- Normal chat flow ---
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== "user") {
          send({ type: "error", content: "No user message found" });
          controller.close();
          return;
        }

        const history: Content[] = messagesToGeminiHistory(messages.slice(0, -1));
        let response = await chatWithGemini(history, lastMessage.content);

        let iterations = 0;
        const MAX_ITERATIONS = 8;
        const queuedWrites: Array<{ name: string; args: Record<string, unknown>; summary: string }> = [];

        while (iterations < MAX_ITERATIONS) {
          const candidate = response.candidates?.[0];
          const parts: Part[] = candidate?.content?.parts || [];

          const functionCallPart = parts.find((p) => p.functionCall);

          if (!functionCallPart?.functionCall) {
            // Gemini done reasoning — send text + any queued writes
            const text = parts
              .map((p) => p.text)
              .filter(Boolean)
              .join("");

            if (queuedWrites.length > 0) {
              // Send AI's explanation text first
              if (text) {
                send({ type: "text", content: text });
              }
              // Then send batch confirmation
              send({
                type: "confirmation",
                pendingAction: {
                  writes: queuedWrites.map((w) => ({
                    functionCall: { name: w.name, args: w.args },
                    summary: w.summary,
                  })),
                  combinedSummary: queuedWrites.map((w) => w.summary).join("\n"),
                },
              });
            } else if (text) {
              send({ type: "text", content: text });
            }
            break;
          }

          const name = functionCallPart.functionCall.name!;
          const args = (functionCallPart.functionCall.args ?? {}) as Record<string, unknown>;

          if (!isKnownTool(name)) {
            send({ type: "error", content: `Unknown tool: ${name}` });
            break;
          }

          if (classifyTool(name) === "write") {
            // Queue the write — don't execute, don't break
            const summary = summarizeAction(name, args);
            queuedWrites.push({ name, args, summary });

            // Send synthetic "queued" result back to Gemini so it can continue reasoning
            const updatedHistory: Content[] = [
              ...history,
              { role: "user", parts: [{ text: lastMessage.content }] },
              {
                role: "model",
                parts: [{ functionCall: { name, args } }],
              },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: {
                        result: {
                          status: "queued_for_approval",
                          action: summary,
                          message: "Bu işlem kullanıcı onayı bekliyor. Kullanıcıya ne yapılacağını açıkla.",
                        },
                      },
                    },
                  },
                ],
              },
            ];

            response = await chatWithToolResult(updatedHistory);
            history.push(
              { role: "user", parts: [{ text: lastMessage.content }] },
              { role: "model", parts: [{ functionCall: { name, args } }] },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: {
                        result: { status: "queued_for_approval", action: summary },
                      },
                    },
                  },
                ],
              }
            );
            iterations++;
            continue;
          }

          // Read operation → execute immediately
          try {
            const result = await executeTool(name, args);

            const updatedHistory: Content[] = [
              ...history,
              { role: "user", parts: [{ text: lastMessage.content }] },
              {
                role: "model",
                parts: [{ functionCall: { name, args } }],
              },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: { result },
                    },
                  },
                ],
              },
            ];

            response = await chatWithToolResult(updatedHistory);

            history.push(
              { role: "user", parts: [{ text: lastMessage.content }] },
              { role: "model", parts: [{ functionCall: { name, args } }] },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: { result },
                    },
                  },
                ],
              }
            );
            iterations++;
          } catch (error) {
            send({
              type: "error",
              content: `Tool error: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
            break;
          }
        }

        if (iterations >= MAX_ITERATIONS) {
          if (queuedWrites.length > 0) {
            send({
              type: "confirmation",
              pendingAction: {
                writes: queuedWrites.map((w) => ({
                  functionCall: { name: w.name, args: w.args },
                  summary: w.summary,
                })),
                combinedSummary: queuedWrites.map((w) => w.summary).join("\n"),
              },
            });
          } else {
            send({
              type: "error",
              content: "Too many tool calls. Please try a simpler request.",
            });
          }
        }
```

- [ ] **Step 2: Update the approval flow to handle batch writes**

Replace the approval section (lines 28-95) — the `if (pendingAction)` block — with:

```typescript
        // --- Approval/Rejection flow ---
        if (pendingAction) {
          const { writes, approved } = pendingAction as { writes: Array<{ functionCall: { name: string; args: Record<string, unknown> }; summary: string }>; approved: boolean; combinedSummary: string };

          if (approved && writes?.length) {
            const results: string[] = [];
            let hasError = false;

            for (const write of writes) {
              const { name, args } = write.functionCall;
              if (!isKnownTool(name)) {
                results.push(`Unknown tool: ${name}`);
                hasError = true;
                continue;
              }
              try {
                const result = await executeTool(name, args);
                results.push(`${write.summary}: OK`);
              } catch (error) {
                results.push(`${write.summary}: FAILED — ${error instanceof Error ? error.message : "Error"}`);
                hasError = true;
              }
            }

            // Get Gemini's follow-up response
            const historyForResult: Content[] = [
              ...messagesToGeminiHistory(messages),
              {
                role: "model",
                parts: writes.map((w) => ({
                  functionCall: { name: w.functionCall.name, args: w.functionCall.args },
                })),
              },
              {
                role: "user",
                parts: writes.map((w) => ({
                  functionResponse: {
                    name: w.functionCall.name,
                    response: { result: results.join("; ") },
                  },
                })),
              },
            ];

            try {
              const response = await chatWithToolResult(historyForResult);
              const text =
                response.candidates?.[0]?.content?.parts?.[0]?.text ||
                (hasError ? results.join("\n") : "İşlemler başarıyla uygulandı.");
              send({ type: "result", content: text });
            } catch {
              send({ type: "result", content: hasError ? results.join("\n") : "İşlemler başarıyla uygulandı." });
            }
          } else {
            const history = messagesToGeminiHistory(messages);
            const response = await chatWithGemini(
              history,
              "Kullanıcı işlemi iptal etti. Devam etme."
            );
            const text =
              response.candidates?.[0]?.content?.parts?.[0]?.text ||
              "İşlem iptal edildi.";
            send({ type: "text", content: text });
          }

          controller.close();
          return;
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: May still have errors in `use-chat.ts` and `confirmation-card.tsx` (fixed next tasks).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "fix: rewrite chat loop to queue write tools instead of breaking the chain"
```

---

### Task 3: Update use-chat hook for batch approval

**Files:**
- Modify: `src/hooks/use-chat.ts`

- [ ] **Step 1: Update approveAction and rejectAction for batch PendingAction**

The `pendingAction` state is already `PendingAction | null`. The type changed from `{ functionCall, summary }` to `{ writes, combinedSummary }`. Update `approveAction`:

In `src/hooks/use-chat.ts`, replace the `approveAction` callback (lines 98-141) with:

```typescript
  const approveAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    const action = pendingAction;
    setPendingAction(null);

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: action.combinedSummary },
      { role: "user", content: "Onaylandı" },
    ]);

    try {
      const body: ChatRequest = {
        messages: [
          ...messages,
          { role: "assistant", content: action.combinedSummary },
          { role: "user", content: "Onaylandı" },
        ],
        pendingAction: { ...action, approved: true },
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await processStream(response);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Hata: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, pendingAction, processStream]);
```

Replace `rejectAction` (lines 143-185) with:

```typescript
  const rejectAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    const action = pendingAction;
    setPendingAction(null);

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: action.combinedSummary },
      { role: "user", content: "İptal edildi" },
    ]);

    try {
      const body: ChatRequest = {
        messages: [
          ...messages,
          { role: "assistant", content: action.combinedSummary },
          { role: "user", content: "İptal edildi" },
        ],
        pendingAction: { ...action, approved: false },
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await processStream(response);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Hata: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, pendingAction, processStream]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: May still error on `confirmation-card.tsx` — fixed next task.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-chat.ts
git commit -m "refactor: update useChat hook for batch write approval flow"
```

---

### Task 4: Update ConfirmationCard for batch preview

**Files:**
- Modify: `src/components/confirmation-card.tsx`

- [ ] **Step 1: Rewrite ConfirmationCard to show batch writes**

Replace the entire content of `src/components/confirmation-card.tsx`:

```typescript
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          {tr.chat.confirmationRequired}
        </p>
        <div className="mb-3 space-y-1.5">
          {action.writes.map((write, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-100">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{write.summary}</span>
            </div>
          ))}
        </div>
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
```

- [ ] **Step 2: Verify full build passes**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: Zero errors — all type changes are now consistent.

- [ ] **Step 3: Commit**

```bash
git add src/components/confirmation-card.tsx
git commit -m "feat: update confirmation card for batch write preview"
```

---

### Task 5: Create undo snapshot library

**Files:**
- Create: `src/lib/undo.ts`

- [ ] **Step 1: Create the undo module**

Create `src/lib/undo.ts`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: PASS (no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/undo.ts
git commit -m "feat: add undo snapshot library for Elementor edits"
```

---

### Task 6: Create undo API route

**Files:**
- Create: `src/app/api/elementor/undo/route.ts`

- [ ] **Step 1: Create the undo REST endpoint**

Create directory and file:

```bash
mkdir -p src/app/api/elementor/undo
```

Create `src/app/api/elementor/undo/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { listSnapshots, restoreSnapshot } from "@/lib/undo";
import { updateElementorData, updateTemplateElementorData } from "@/lib/wordpress";

export async function GET(req: NextRequest) {
  try {
    const pageId = Number(req.nextUrl.searchParams.get("pageId"));
    if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });
    const snapshots = listSnapshots(pageId);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();
    if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

    const { pageId, type, elementorData } = restoreSnapshot(filename);

    if (type === "templates") {
      await updateTemplateElementorData(pageId, elementorData);
    } else {
      await updateElementorData(pageId, (type as "pages" | "posts") || "pages", elementorData);
    }

    return NextResponse.json({ success: true, pageId, restoredFrom: filename });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/elementor/undo/route.ts
git commit -m "feat: add undo REST API for Elementor snapshot restore"
```

---

### Task 7: Wire undo into tool execution

**Files:**
- Modify: `src/lib/tools.ts`

Before every write tool executes, save an undo snapshot. This happens in the `executeTool` function for Elementor write tools.

- [ ] **Step 1: Add undo snapshots to write tool execution**

At the top of `src/lib/tools.ts`, add the import:

```typescript
import { saveSnapshot } from "./undo";
```

Then in the `executeTool` function, add snapshot saving before each Elementor write tool. Find the `case "update_elementor_styles":` block and add before the `applyJsonPatches` call:

```typescript
      // Save undo snapshot before modifying
      saveSnapshot(args.id as number, contentType, typeof rawData === "string" ? rawData : JSON.stringify(rawData));
```

Do the same for `case "clone_element":` — add before the `insertElement` call:

```typescript
      // Save undo snapshot before modifying
      saveSnapshot(pageId, contentType, typeof rawData === "string" ? rawData : JSON.stringify(rawData));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/tools.ts
git commit -m "feat: save undo snapshot before Elementor write operations"
```

---

### Task 8: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Verify the chat loop fix with curl**

```bash
curl -s -m 90 -X POST "http://localhost:3004/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"947 numarali sayfanin (pages) basliklarinin rengini #ff0000 yap"}]}'
```

Expected: Response should contain a `confirmation` chunk with `writes` array containing an `update_elementor_styles` action. Not just text narration.

- [ ] **Step 2: Verify approval executes the write**

```bash
curl -s -m 60 -X POST "http://localhost:3004/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}], "pendingAction": {"writes": [{"functionCall": {"name": "update_elementor_styles", "args": {"id": 947, "content_type": "pages", "patches": [{"elementId": "1c42aedd", "settings": {"title_color": "#ff0000"}}]}}, "summary": "Test color change"}], "combinedSummary": "Test color change", "approved": true}}'
```

Expected: A `result` chunk confirming the change was applied.

- [ ] **Step 3: Verify undo snapshot was created**

```bash
curl -s "http://localhost:3004/api/elementor/undo?pageId=947"
```

Expected: JSON with `snapshots` array containing at least one entry with `pageId: 947`.

- [ ] **Step 4: Verify undo restores the snapshot**

Use the filename from step 3:

```bash
curl -s -X POST "http://localhost:3004/api/elementor/undo" \
  -H "Content-Type: application/json" \
  -d '{"filename": "<filename-from-step-3>"}'
```

Expected: `{ "success": true, "pageId": 947 }`

- [ ] **Step 5: Full build check**

Run: `npx tsc --noEmit 2>&1 | grep -v '.next/'`

Expected: Zero errors.

- [ ] **Step 6: Commit everything and push**

```bash
git add -A
git commit -m "feat: complete chat loop fix with batch writes and undo system

- Write tools no longer break the read→reason→write chain
- Queued writes presented as batch confirmation with preview
- Undo snapshots saved before every Elementor write operation
- Undo REST API for listing and restoring snapshots

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

git push
```
