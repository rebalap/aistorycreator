

## Implementation: Arabic Language Toggle

The approved plan has not been implemented yet — no code changes or database migrations were executed. Here's what needs to be done:

### Step 1: Database Migration
Add a `language` column to the `stories` table:
```sql
ALTER TABLE public.stories ADD COLUMN language text NOT NULL DEFAULT 'en';
```

### Step 2: Add Arabic Font (`index.html`)
Add Google Fonts link for "Noto Naskh Arabic" for canvas rendering support.

### Step 3: Update `MetadataBar.tsx`
- Add `language` and `onLanguageChange` props
- Add a third column with an EN/AR toggle group using Radix ToggleGroup
- Change grid from `md:grid-cols-2` to `md:grid-cols-3`

### Step 4: Create Translation Edge Function
New file: `supabase/functions/translate-story-text/index.ts`
- POST endpoint accepting `{ text, targetLanguage }`
- Uses `google/gemini-2.5-flash-lite` for translation
- Returns `{ translatedText }`

### Step 5: Update `Index.tsx`
- Add `language` state (`'en' | 'ar'`, default `'en'`)
- Pass `language` / `onLanguageChange` to MetadataBar
- Add "Translate" button next to textarea
- When Arabic: set `dir="rtl"` on Textarea, change placeholder to Arabic
- Update `renderPageToBlob` for RTL canvas rendering
- Persist language in save/load flow
- Load language from story data in `loadStory`

### Step 6: Update `StoryPagePreview.tsx`
- Add `language` prop
- When Arabic: text container gets `dir="rtl"`, Arabic font, right alignment
- Editing textarea also gets RTL direction

### Step 7: Update `useAutosave.tsx`
- Add `language` to `StoryDraft` interface and all related functions

### Step 8: Update `useStories.tsx`
- Add `language` to `Story` interface
- Update `createStory` to accept and pass `language`

### Files to Create/Modify
1. **Database migration** — Add `language` column
2. **`supabase/functions/translate-story-text/index.ts`** — New edge function
3. **`index.html`** — Add Noto Naskh Arabic font
4. **`src/components/MetadataBar.tsx`** — Language toggle UI
5. **`src/pages/Index.tsx`** — Language state, RTL support, translate button, canvas RTL
6. **`src/components/StoryPagePreview.tsx`** — RTL preview
7. **`src/hooks/useAutosave.tsx`** — Language in drafts
8. **`src/hooks/useStories.tsx`** — Language in CRUD

