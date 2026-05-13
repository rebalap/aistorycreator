## Goal

Persist all three language versions (English, Arabic, Telugu) of every story's title and page text in the database. Stop relying on the `translate-story-text` edge function at view/generation time. The HeyGen video generation continues to be WYSIWYG — it sends whatever the user currently sees in the selected language.

## Current behavior

- `stories.title` and `story_pages.text` each store a single string in whatever language was last edited.
- Switching language in the editor calls the `translate-story-text` edge function on every toggle, then mutates local state.
- Saving persists only the currently displayed language, so the other two are lost on reload.
- HeyGen already receives `pageTexts`/`coverTitle` from live UI state (WYSIWYG) — that part stays.

## Plan

### 1. Schema changes (migration)

Add per-language columns (nullable text, no defaults) so existing rows keep working:

- `stories`: `title_en`, `title_ar`, `title_te`
- `story_pages`: `text_en`, `text_ar`, `text_te`

Keep the existing `stories.title` and `story_pages.text` columns as the "current/displayed" value (what HeyGen and legacy readers use). The new columns are the persistent translations cache.

Backfill: for each existing row, copy `title` → `title_<language>` and `text` → `text_<language>` based on `stories.language`.

No RLS changes needed — new columns inherit existing table policies.

### 2. Translation flow (frontend)

When the user clicks the language toggle for the whole story (cover + all pages) or the per-page translate button:

1. For each target string, first check the corresponding `*_<lang>` field on the loaded story/page state. If present, use it directly — no edge function call.
2. If missing, call `translate-story-text` once, then store the result back into both:
   - local state (so the UI updates immediately), and
   - the `*_<lang>` column in the DB (so it's cached forever).
3. Always update `stories.title` / `story_pages.text` and `stories.language` to reflect the current displayed language (keeps WYSIWYG contract for HeyGen and downloads).

Edits in a given language overwrite only that language's `*_<lang>` column and the "current" `title`/`text`. The other two cached translations become stale and are cleared (set to `NULL`) so they'll be re-translated on next switch. This keeps semantics simple: the visible language is the source of truth; others are regenerated on demand.

### 3. Loading

Story fetch (`loadStory` / list view) already pulls all columns via `select *`. Extend the local `Story` / `Page` types to include the new `title_en/ar/te` and `text_en/ar/te` fields. On load, hydrate state from `*_<currentLanguage>` if present, otherwise from `title`/`text`.

### 4. Saving

Update the save path so it writes:
- `stories`: `title`, `language`, and `title_<language>` (only the currently shown one).
- `story_pages`: `text`, and `text_<language>` (only the currently shown one).
- Clears the other two language columns when text has been edited since last translation (tracked by a "dirty" flag per language in local state — or simpler: any edit in language X nulls out the other two cached versions).

### 5. Video generation

No changes to `heygen-generate-video` edge function. `GenerateVideoDialog` keeps receiving `pageTexts` / `coverTitle` / `language` from live UI state — fully WYSIWYG.

### 6. Out of scope

- No automatic background pre-translation of all three languages. Translations are still on demand, just cached after the first translate.
- No changes to RLS, auth, or storage.
- No removal of the `translate-story-text` edge function — it's still used the first time a language is requested.
- No change to `stories.language` semantics (still "currently displayed language").

## Technical details

- Migration adds 6 nullable `TEXT` columns and runs a one-time `UPDATE` to backfill from existing single-language rows.
- `src/lib/storyApi.ts` (or equivalent CRUD helpers) updated: `updateStory`, `updatePage`, `createStory`, `createPage` accept optional per-language fields; `loadStory` returns them.
- `src/pages/Index.tsx`:
  - `setLanguage` flow checks cached `title_<lang>` / `text_<lang>` before invoking `translate-story-text`.
  - On any text edit, null out the two non-current language caches in DB (debounced with the existing autosave).
  - On translation result, persist into `*_<lang>` column.
- `src/integrations/supabase/types.ts` will regenerate automatically after the migration; no manual edit.
