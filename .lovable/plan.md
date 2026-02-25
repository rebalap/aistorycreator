

## Plan: Arabic Language Toggle in MetadataBar

### Overview

Add a language toggle (English/Arabic) to the MetadataBar component, alongside the character and background image uploaders. When Arabic is selected, the story text input switches to RTL with an Arabic font, the preview renders RTL, and downloaded images render Arabic text right-to-left. A "Translate" button will use AI to translate existing text between languages.

### 1. Database Change

Add a `language` column to the `stories` table:

```sql
ALTER TABLE public.stories ADD COLUMN language text NOT NULL DEFAULT 'en';
```

### 2. MetadataBar Update (`src/components/MetadataBar.tsx`)

- Accept new props: `language: 'en' | 'ar'` and `onLanguageChange: (lang) => void`
- Add a third column to the grid (change to `md:grid-cols-3`) with a language toggle
- Use two toggle buttons: "English" / "عربي" styled as a toggle group
- Show current language selection clearly

### 3. Translation Edge Function (`supabase/functions/translate-story-text/index.ts`)

- Accepts `{ text, targetLanguage }` via POST
- Uses Lovable AI (`google/gemini-2.5-flash-lite`) with prompt: "Translate the following children's story text to [Arabic/English]. Keep it simple, age-appropriate, and preserve the storytelling tone."
- Returns `{ translatedText }`
- Handles 429/402 rate limit errors

### 4. Index.tsx Changes

- Add `language` state (`'en' | 'ar'`, default `'en'`)
- Pass `language` and `onLanguageChange` to MetadataBar
- Add a "Translate" button next to the story text textarea that calls the edge function and replaces the text
- When `language === 'ar'`: set `dir="rtl"` on the Textarea, use Arabic font class, change placeholder to Arabic
- Pass `language` to `StoryPagePreview`
- Update `renderPageToBlob`: when Arabic, use `ctx.direction = "rtl"`, `ctx.textAlign = "right"`, Arabic-safe font (Tahoma), and adjust text X position to right side
- Persist `language` in save/load story flow (via the new DB column)
- Load language from story data in `loadStory`
- Include language in `handleSaveStory` → `updateStory` / `createStory`

### 5. StoryPagePreview Changes (`src/components/StoryPagePreview.tsx`)

- Accept `language` prop
- When `language === 'ar'`: text container gets `dir="rtl"`, font changes to `"Tahoma", "Arabic Typesetting", sans-serif`, text alignment right
- Editing textarea also gets RTL direction

### 6. Autosave Integration (`src/hooks/useAutosave.tsx`)

- Add `language` to `StoryDraft` interface
- Include in `getCurrentDraft`, `getDraftHash`, and `handleRestoreDraft`

### 7. Font Addition (`index.html`)

- Add Google Fonts link for "Noto Naskh Arabic" for consistent Arabic rendering in canvas downloads

### 8. useStories Hook

- Update `createStory` and `updateStory` to handle the `language` field

### Files to Create/Modify

1. **Database migration** — Add `language` column
2. **`supabase/functions/translate-story-text/index.ts`** — New translation edge function
3. **`src/components/MetadataBar.tsx`** — Add language toggle UI
4. **`src/pages/Index.tsx`** — Language state, RTL textarea, translate button, RTL canvas rendering, persist language
5. **`src/components/StoryPagePreview.tsx`** — RTL preview support
6. **`src/hooks/useAutosave.tsx`** — Add language to draft
7. **`index.html`** — Add Noto Naskh Arabic font
8. **`src/hooks/useStories.tsx`** — Handle language field in CRUD

