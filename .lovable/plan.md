## Problem

The text HeyGen narrates may be stale or in the wrong language. Currently the edge function reads `story_pages.text` and `stories.title` from the database. The user-facing language and any in-progress translation live in the React state of `Index.tsx`, and the DB row may lag (autosave is debounced ~30s). The cover scene also uses the title verbatim, which is not translated by the toggle.

## Plan

### 1. Send the live text from the client
- In `src/pages/Index.tsx`, pass two new props to `GenerateVideoDialog`:
  - `pageTexts: Record<number, string>` — current displayed text per page number, taken from the `pages` state.
  - `coverTitle: string` — the current displayed title (already in component state).
  - `language: 'en' | 'ar' | 'te'` — selected app language.
- In `src/components/GenerateVideoDialog.tsx`, accept these props and forward them in the invoke body alongside the existing `framesByPage` / `coverFrameUrl`.

### 2. Edge function uses client-provided text
- In `supabase/functions/heygen-generate-video/index.ts`:
  - Add optional `pageTexts: Record<string, string>`, `coverTitle?: string`, `language?: string` to `SubmitBody`.
  - When building scenes, prefer `pageTexts[page_number]` over `p.text`, and `coverTitle` over `story.title`.
  - Log the language and a short text preview so we can verify in logs.

### 3. Voice/language sanity hint (UI only)
- In the voice picker, when a `language` prop is provided, default the language filter dropdown to that language on first open (instead of `"all"`), so the user is steered to a voice that matches. Still allow them to change it.

## Out of scope
- No DB schema change; we keep storing single-language `text` like today.
- Not auto-translating server-side — we trust whatever the user has in the UI.
- Not changing how the page frames are rendered (text on the right is already in the selected language since it reads from the same source).
