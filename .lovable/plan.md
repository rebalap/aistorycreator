## Problem 1 — "Save failed" toast appears even though the save succeeded

`useStories.updateStory` and `useStories.saveStoryPages` each fire their own `toast.error(...)` on failure but still let `handleSaveStory` continue and fire `toast.success("Story saved!")`. So the user sees a misleading "save failed" first.

The most likely root cause of the inner failure when in Telugu is a **race with the 30s database autosave**: switching language triggers state changes, the autosave's `setInterval` may fire `saveToDatabase` (which does a `DELETE` then `INSERT` on `story_pages`) at the same moment the manual Save runs the same delete+insert, and one of the two `.single()` updates returns no row / a transient `57014` timeout (already visible in your console logs). The save still ends up persisted because the other write wins.

### Fixes

1. **Stop double-toasting in `useStories.tsx`.**
   - Remove `toast.error("Failed to update story")` from `updateStory`.
   - Remove `toast.error("Failed to save pages")` from `saveStoryPages`.
   - Re-throw the real error so the caller can decide. `handleSaveStory`, `saveToDatabase` (autosave) already have `try/catch` blocks.

2. **Surface the real error in `handleSaveStory` (`src/pages/Index.tsx`).**
   - Replace the generic `toast.error("Failed to save story")` with `toast.error(error?.message || "Failed to save story", { duration: 8000 })` so we can see the underlying Postgres error if it ever returns.

3. **Prevent the autosave race during a manual save.**
   - Add an `isManualSavingRef` (or pass `isSaving` into `useAutosave`) and skip the 30s `saveToDatabase` tick whenever a manual save is in flight.
   - In `handleSaveStory`, set the flag before `updateStory`, clear it in `finally`.

## Problem 2 — Video generates in English on the first try, and UI snaps back to English when Generate is clicked

Two independent bugs combine:

### 2a. Edge function silently falls back to the English DB rows

In `supabase/functions/heygen-generate-video/index.ts`:

```ts
const text = pageTexts[String(p.page_number)]?.trim() || p.text;
const effectiveTitle = (body.coverTitle?.trim() || story.title || "").trim();
```

`p.text` and `story.title` are whatever was last saved to the DB. If the user switched to Telugu but hasn't saved yet (the manual Save races, or the 30s autosave hasn't fired), the DB still holds English. Any single missing/empty client-supplied field flips that page back to English. Cover title in particular reads `story.title` not `story.title_te`.

Fix: send the language explicitly (already done — `body.language`), and on the server, prefer the client-supplied texts and only fall back to the matching language column (`text_te` / `title_te`), never to `text` / `title` when a non-English language is requested.

```ts
const langKey = body.language === 'ar' ? 'text_ar' : body.language === 'te' ? 'text_te' : 'text_en';
const text = pageTexts[String(p.page_number)]?.trim()
          || (p as any)[langKey]?.trim()
          || p.text;   // last-resort English
```

Same treatment for the cover title (`title_te` / `title_ar` / `title_en` columns on `stories`).

Also log `body.language` and the first scene's chosen text source so we can confirm.

### 2b. UI reverts to English after clicking Generate

The only places that call `setLanguage('en')` are `handleReset` and `loadStory` (via the `[storyId, user, draftRestored]` URL effect). The most likely trigger is the URL effect re-running after a `user` reference change during the long async Generate, which causes `loadStory` to re-hydrate from the DB — and the DB still has `language='en'` because nothing has persisted Telugu yet.

Fix: persist the language switch immediately so a re-hydrate is harmless.

- In `handleLanguageChange`, after `applyFromCache`, if `currentStoryId` exists, fire-and-forget `updateStory(currentStoryId, { language: newLang, title_en, title_ar, title_te, title })` plus `saveStoryPages(...)` with the per-language columns. This is the same payload the manual save sends.
- Show a tiny inline "saving translation…" indicator while it runs (reuse autosave status).

This also guarantees the edge function's DB fallback (Problem 2a) never reads stale English.

Belt-and-braces: in the URL effect, don't re-run `loadStory` if `currentStoryId === storyId` (avoid re-hydration when only `user` reference changed).

## Files

- `src/hooks/useStories.tsx` — remove inner error toasts; re-throw.
- `src/pages/Index.tsx` — surface real save error; persist language on switch; guard URL effect; pass manual-saving flag to autosave.
- `src/hooks/useAutosave.tsx` — accept and respect `isManualSaving` flag in the 30s tick.
- `supabase/functions/heygen-generate-video/index.ts` — language-aware text/title fallback; richer logging.

## Verification

- Switch story to Telugu → reload page: language stays Telugu (DB now has it).
- Click Save in Telugu: only one toast, "Story saved!" (no false "save failed").
- Generate video in Telugu first try: edge log shows `language: "te"` and Telugu first-text preview; rendered video narrates Telugu; UI stays in Telugu after clicking Generate.
