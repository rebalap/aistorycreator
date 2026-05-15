## Goals

1. Cleanup the top action bar — keep all current buttons but reduce visual clutter (icon-first, clearer hierarchy, less text noise).
2. Add a second video generation path that uses HeyGen's Template API with a fixed template ID stored as a Lovable secret (`HEYGEN_TEMPLATE_ID`).

---

## 1. Top bar cleanup (visual only — no buttons removed)

File: `src/pages/Index.tsx` (header block ~lines 1094–1222)

Changes:
- Status chip ("Saving / Saved / Unsaved / Ready") becomes a small pill next to the title with just an icon + tooltip on hover (no text on desktop). Removes the long "AI-powered multi-page stories • Saved • Usage…" subtitle clutter; keep tagline only on first-load empty state.
- Action buttons → consistent icon-only on `lg` breakpoint with tooltips, label text shown only on `xl`. Order: **My Shelf · Save · Download All · Generate Video ▾ · Reset · Sign out**.
- "Download All (N)" — drop the count from the label, show as a small badge on the icon.
- Convert **Generate Video** into a split/dropdown button with two items:
  - **Custom (Scenes)** — current flow, opens existing `GenerateVideoDialog`.
  - **Quick (Template)** — new flow, opens a new lightweight `GenerateVideoTemplateDialog`.
- Group `Reset` + `Sign out` visually (separator) so destructive/account actions sit apart from creation actions.
- Use `shadcn/ui` `DropdownMenu` for the Generate Video split, and `Tooltip` for icon-only buttons. No new colors — use existing semantic tokens.

No business logic changes in this section. Save / autosave / download flows stay identical.

---

## 2. New "Generate via Template" flow

### Secret
Request `HEYGEN_TEMPLATE_ID` via `add_secret` (user pastes their template ID from HeyGen). Edge function reads it from `Deno.env`.

### New dialog: `src/components/GenerateVideoTemplateDialog.tsx`
Minimal — Template flow doesn't need scene-by-scene config:
- Voice picker (reuse `heygen-list-voices`, same filtering by app language).
- Speed slider (default 0.8×).
- Aspect ratio (read-only, defined by the template — show a note "Defined by template").
- Same frame-prep pipeline (`renderPageFrame` / `renderCoverFrame`, upload to `story-images/<uid>/video-frames/...`) so we can pass per-scene image URLs as template variables.
- Submit → `supabase.functions.invoke('heygen-generate-video', { body: { mode: 'template', ... } })`.
- Reuse the existing `pollStatus` logic.

### Edge function: `supabase/functions/heygen-generate-video/index.ts`
Add a branch on `body.mode`:
- `mode === 'template'` (new):
  - Read `HEYGEN_TEMPLATE_ID` from env. 400 if missing.
  - Fetch template details: `GET https://api.heygen.com/v2/template/{template_id}` to discover variable names/types.
  - Build `variables` payload by mapping our scenes onto template variables in order:
    - For each `image` variable → next page/cover frame URL.
    - For each `text` variable → next page text (language-aware, same `text_en/_ar/_te` fallback we already added).
    - For each `voice` variable → selected `voiceId`.
  - POST `https://api.heygen.com/v2/template/{template_id}/generate` with `{ caption: false, title, variables, dimension? }`.
  - Persist `heygen_video_id` on `stories` (existing column) — same status polling path works because both endpoints return `video_id` and the existing `action: 'status'` branch hits `/v1/video_status.get`.
- `mode === 'custom'` (default, existing): unchanged.

Keep the language-aware fallback we added (`text_te`/`title_te` etc.) for the template branch too.

### Reference
HeyGen Template API: https://developers.heygen.com/template-api  (`GET /v2/template/{id}`, `POST /v2/template/{id}/generate`).

---

## Files touched

- `src/pages/Index.tsx` — header restyle; split-button for Generate Video; mount new template dialog.
- `src/components/GenerateVideoTemplateDialog.tsx` — new, ~150 lines, mirrors the minimal subset of `GenerateVideoDialog`.
- `supabase/functions/heygen-generate-video/index.ts` — add `mode: 'template'` branch + template fetch + variables mapper.
- Secret: add `HEYGEN_TEMPLATE_ID`.

## Verification

- Top bar: at `lg` width buttons are icon-only with working tooltips; nothing wraps to two rows; Generate Video dropdown shows both items.
- Quick (Template) flow: with `HEYGEN_TEMPLATE_ID` set, clicking Quick → picks voice → submits → edge log shows `mode: template`, template variables populated, `video_id` returned, polling completes, `video_url` saved on the story (same as Custom flow).
- Switching to Telugu and immediately using Quick still produces Telugu narration (language-aware fallback path is shared).
