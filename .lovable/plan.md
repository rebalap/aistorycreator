## Plan: Add Telugu Language Support

Extend the existing English/Arabic toggle to include Telugu (తెలుగు) as a third option. Telugu is LTR like English, so no RTL handling is needed — just font support and translation routing.

### Changes

1. **Type updates** — Expand the `language` union from `"en" | "ar"` to `"en" | "ar" | "te"` across:
   - `src/components/MetadataBar.tsx`
   - `src/pages/Index.tsx`
   - `src/components/StoryPagePreview.tsx`
   - `src/hooks/useAutosave.tsx` (`StoryDraft.language`)
   - `src/hooks/useStories.tsx` (createStory signature)

2. **MetadataBar UI** — Add a third `ToggleGroupItem` with value `"te"` and label `తెలుగు`.

3. **Font support** (`index.html`) — Add Google Fonts link for `Noto Sans Telugu` alongside the existing Noto Naskh Arabic.

4. **Font-family application** (`Index.tsx` / `StoryPagePreview.tsx` / canvas download code) — When `language === "te"`, apply `'Noto Sans Telugu', sans-serif`. Direction stays LTR.

5. **Translation edge function** (`supabase/functions/translate-story-text/index.ts`) — Extend the `langName` mapping:
   ```ts
   const langName = targetLanguage === "ar" ? "Arabic"
                  : targetLanguage === "te" ? "Telugu"
                  : "English";
   ```
   Batch logic and JSON-array parsing remain unchanged.

6. **Translation handler** (`Index.tsx` `handleLanguageChange`) — Already generic over `newLang`; just widen the parameter type so Telugu triggers the same batch translate flow (English↔Telugu, Arabic↔Telugu, etc.).

7. **DB** — No schema change. The existing `language text` column already accepts `'te'`.

### Notes
- Telugu uses LTR direction, so no `dir="rtl"` toggling for it.
- All three languages translate to/from each other via the same edge function call.
