
## Problem

Selecting Telugu in the language toggle changes the font but leaves the text in English. The same flow works for the backend — calling the `translate-story-text` edge function manually with `targetLanguage: "te"` returns valid Telugu translations. Edge function logs show **no recent invocations** when the user toggles, so the call is never made from the client.

## Likely cause

In `src/pages/Index.tsx`, `handleLanguageChange` short‑circuits when it thinks every page already has a cached translation:

```ts
const cached = p.translations?.[newLang];
if (!cached && p.text.trim()) pageMissIndices.push(i);
...
if (textsToTranslate.length === 0) {
  applyFromCache(titleCacheWithSnapshot, pagesWithSnapshot);  // no API call
  return;
}
```

Then `applyFromCache` does:

```ts
text: p.translations?.[newLang] || (p.text.trim() ? p.text : ""),
```

So when `translations.te` is missing **but every page also has empty `text`**, or when `translations.te` is mistakenly populated with non‑Telugu content (stale cache from the older single‑text translate button that pre‑dates the cache), the client treats the cache as a hit, sets `language = 'te'` (font flips to Noto Sans Telugu), and re‑displays the existing English `text`. That matches the symptom exactly.

A second related issue: `MetadataBar` calls `onLanguageChange` synchronously without awaiting; if `handleLanguageChange` throws before `setLanguage`, language never flips — but here it flips, which confirms we are taking the cache‑hit branch.

## Plan

### 1. Make the cache check trustworthy

In `src/pages/Index.tsx` → `handleLanguageChange`:

- Treat a cache entry as a hit only when it is non‑empty **and** different from the source `text` (any entry equal to the source text is almost certainly a stale pre‑cache leftover, since a real translation to a different language can never be byte‑identical for non‑empty story text).
- Apply the same rule to `titleCacheWithSnapshot[newLang]` vs `currentTitleSnapshot`.

Result: legitimate Telugu cache still avoids an API call, but stale "English in `translations.te`" entries are ignored and trigger a real translation.

### 2. Surface translation failures in the UI

Currently if the API returns an unexpected shape we throw and toast, but if it returns 0 items or is short‑circuited we silently flip language. Add:

- A `console.info` log in `handleLanguageChange` summarizing `textsToTranslate.length`, `pageMissIndices`, and which titles were considered cache hits — so we can confirm the path in the browser console next time.
- If `texts.length === 0` because every page text is empty AND no title needs translation, still call `setLanguage(newLang)` but skip the toast (current behavior is fine here).

### 3. One‑time migration of stale caches on draft restore

In `handleRestoreDraft` (and the `loadStory` hydration path), normalize each page's `translations` so any entry equal to `p.text` for a *different* language is reset to `null`. This clears the bad cache without forcing the user to re‑edit.

### 4. Verify

- Reload the preview, toggle EN → TE on the restored "Things Change" draft.
- Confirm a `POST /functions/v1/translate-story-text` request fires with `targetLanguage: "te"`.
- Confirm the rendered text becomes Telugu glyphs and that subsequent toggles EN ↔ TE use the cache (no second network call).
- Check `supabase--edge_function_logs translate-story-text` shows the new invocation.

### Files to change

- `src/pages/Index.tsx` — tighten cache‑hit logic in `handleLanguageChange`, sanitize translations in `handleRestoreDraft` and `loadStory`, add a `console.info` trace.

No backend or schema changes — the edge function itself is verified working.
