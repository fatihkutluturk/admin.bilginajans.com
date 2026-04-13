# Chat-Based Elementor Editor: Fixed Architecture

## Problem

Non-technical clients need to edit WordPress/Elementor sites with natural language ("Logo'yu büyüt", "Rengi mavi yap", "Bu yazıyı blog sayfasına ekle"). The chat UI was the right UX — the execution architecture was broken.

**Root cause:** The server's chat loop stops when Gemini calls a write tool, breaking the read→reason→write chain. Gemini can read a page's JSON but can't follow up with a write action in the same turn. This causes the AI to narrate what it would do instead of acting.

## Solution

Fix the server's tool-calling loop to let read tools chain freely and queue write tools for a single preview-then-confirm step. No UI redesign needed — the existing chat becomes a powerful Elementor editor.

## Architecture Change

### Current (broken)
```
while (iterations < MAX) {
  response = gemini(history)
  if (functionCall) {
    if (WRITE_TOOL) → send confirmation, BREAK  ← kills the chain
    if (READ_TOOL)  → execute, feed result back to gemini
  } else {
    send text response, BREAK
  }
}
```

### Fixed
```
while (iterations < MAX) {
  response = gemini(history)
  if (functionCall) {
    if (WRITE_TOOL) → queue it, feed back: { status: "queued_for_approval", action: summarizeAction(name, args) }
    if (READ_TOOL)  → execute, feed result back to gemini
  } else {
    // Gemini done reasoning
    if (queued writes) → send preview confirmation with all queued writes
    else → send text response
    BREAK
  }
}
```

**Key difference:** Write tools don't break the loop. Instead, they're queued and a synthetic "this action is queued, pending user approval" result is sent back to Gemini. Gemini continues reasoning and may call more tools. When Gemini finally generates a text response (done reasoning), the server sends any queued writes as a confirmation card.

### File changes

**`src/app/api/chat/route.ts`** — the only critical change:
- Add a `queuedWrites` array
- When write tool detected: push to queue, send synthetic result back to Gemini
- When text response (end of reasoning): if queue has items, send confirmation with preview
- Confirmation includes all queued writes as a batch

**`src/hooks/use-chat.ts`** — update approval flow:
- `pendingAction` can now be a batch of writes (array)
- Approval executes all queued writes in sequence
- Show combined preview of all changes

**`src/components/confirmation-card.tsx`** — enhance preview:
- Show each queued write as a line item with details
- Single "Uygula" button for the batch

## Undo System

**Before executing approved writes:** Snapshot current `_elementor_data`.

**Storage:** Server-side in the data directory (`/app/data/undo/`) as JSON files.
- Key: `{pageId}-{timestamp}.json`
- Keep last 10 snapshots per page
- Exposed via `GET /api/elementor/undo?pageId=X` to list snapshots
- Exposed via `POST /api/elementor/undo` to restore a snapshot

**Client UI:** After successful write, show "Geri Al" (Undo) link in the success message. Also accessible from a small "Geçmiş" button in the chat header.

## What Clients Can Now Say

All of these work because Gemini can read→reason→write in one flow:

| Client request | AI flow |
|---|---|
| "Logo'yu büyüt" | list_templates(header) → get_elementor_json → update_elementor_styles(image_size) |
| "Rengi mavi yap" | get_elementor_json → find heading widgets → update_elementor_styles(title_color) |
| "Bu yazıyı blog sayfasına ekle" | list_pages(slug) → get_elementor_json(blog) → clone_element |
| "Mobilde menü görünmüyor" | list_templates(header) → get_elementor_json → update_elementor_styles(display_mobile) |
| "Telefon numarasını değiştir" | list_templates(footer) → get_elementor_json → update_elementor_styles(title/editor text) |
| "Butonu daha dikkat çekici yap" | get_elementor_json → update_elementor_styles(button colors, size, border_radius) |

## Existing Code Reused (no changes needed)

- `src/lib/elementor.ts` — extractJsonForAI, applyJsonPatches, cloneElementWithContent, insertElement
- `src/lib/tools.ts` — all tool executors (get_elementor_json, update_elementor_styles, clone_element, list_templates)
- `src/lib/wordpress.ts` — getPageWithMeta, updateElementorData, getTemplateWithMeta
- `src/lib/gemini.ts` — tool declarations, chatWithGemini, chatWithToolResult
- `src/lib/prompt-defaults.ts` — Elementor editing guidelines (already written)

## New Code

### Modified files
- `src/app/api/chat/route.ts` — fix the tool-calling loop (core fix)
- `src/hooks/use-chat.ts` — batch approval support
- `src/components/confirmation-card.tsx` — preview display for batch writes

### New files
- `src/app/api/elementor/undo/route.ts` — undo snapshot management
- `src/lib/undo.ts` — snapshot save/restore/list functions

## Verification

1. Open AI Asistan, type "Header'ımda neler var"
   → AI calls list_templates + get_elementor_json in sequence → shows structure
2. Type "Logo boyutunu 200px yap"
   → AI calls get_elementor_json → finds logo → calls update_elementor_styles
   → Preview card appears: "Logo widget image_size: 100→200px"
   → User clicks "Uygula" → change saved → "Geri Al" link shown
3. Type "Blog sayfasına yeni kart ekle: Ankara Avukatlar"
   → AI calls get_elementor_json(blog) → calls clone_element
   → Preview: "Yeni kart ekleniyor: 'Ankara Avukatlar'"
   → User clicks "Uygula" → card added
4. Click "Geri Al" → card removed, page restored to pre-clone state
5. Type "Mobilde header padding'ini azalt"
   → AI chains: list_templates(header) → get_elementor_json → update_elementor_styles(padding_mobile)
   → Preview shows the padding change → user confirms
