

## Plan: Auto-translate all content when language toggle changes

### Problem
Currently, switching the language toggle only changes the text direction and font. It does not translate the story title or page texts. The user expects toggling to Arabic to automatically translate everything.

### Approach
Modify the `onLanguageChange` handler in `Index.tsx` to:

1. When the language toggle changes (e.g. EN → AR or AR → EN), collect the story title and all page texts
2. Call the existing `translate-story-text` edge function for each piece of text (batch into a single call by sending all texts together)
3. Update the story title, cover title, and all page texts with the translated results
4. Show a loading indicator during translation

### Changes

**1. Update `translate-story-text` edge function** (`supabase/functions/translate-story-text/index.ts`)
- Accept an array of texts instead of a single text: `{ texts: string[], targetLanguage }`
- Return `{ translatedTexts: string[] }`
- Translate all texts in a single AI call for efficiency (send them numbered so the model returns them in order)

**2. Update `Index.tsx`**
- Replace `onLanguageChange={setLanguage}` with a new `handleLanguageChange` function
- This function will:
  - Show a loading toast/state
  - Collect: story title + all page texts that are non-empty
  - Call the updated edge function with all texts and the target language
  - Apply translated results: update `storyTitle`, `coverTitle`, and each page's `text`
  - Set the new language state
  - Handle errors gracefully (revert language if translation fails)
- Add a translating overlay/spinner so the user knows translation is in progress
- The existing single-text "Translate" button next to the textarea can remain as-is (for translating individual pages), or be updated to use the same batch endpoint

### Technical Details

**Edge function prompt update:**
```
Translate the following numbered children's story texts to [Arabic/English].
Keep them simple, age-appropriate, and preserve the storytelling tone.
Return ONLY a JSON array of translated strings in the same order.

1. [title]
2. [page 1 text]
3. [page 2 text]
...
```

**`handleLanguageChange` pseudocode:**
```typescript
const handleLanguageChange = async (newLang: 'en' | 'ar') => {
  if (newLang === language) return;
  
  const textsToTranslate = [storyTitle, ...pages.map(p => p.text)].filter(Boolean);
  if (textsToTranslate.length === 0) { setLanguage(newLang); return; }
  
  setIsTranslating(true);
  const { data, error } = await supabase.functions.invoke('translate-story-text', {
    body: { texts: textsToTranslate, targetLanguage: newLang }
  });
  
  // Apply: first result = title, rest = page texts
  setStoryTitle(translatedTexts[0]);
  setCoverTitle(translatedTexts[0]);
  // Update each page text...
  setLanguage(newLang);
  setIsTranslating(false);
};
```

### Files to modify
1. **`supabase/functions/translate-story-text/index.ts`** — Support batch translation (array of texts)
2. **`src/pages/Index.tsx`** — New `handleLanguageChange` that translates all content on toggle

