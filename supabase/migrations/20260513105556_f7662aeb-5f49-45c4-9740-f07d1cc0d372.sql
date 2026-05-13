-- Add per-language cache columns
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS title_te TEXT;

ALTER TABLE public.story_pages
  ADD COLUMN IF NOT EXISTS text_en TEXT,
  ADD COLUMN IF NOT EXISTS text_ar TEXT,
  ADD COLUMN IF NOT EXISTS text_te TEXT;

-- Backfill stories: copy title into the column matching its current language
UPDATE public.stories SET title_en = title WHERE language = 'en' AND title_en IS NULL;
UPDATE public.stories SET title_ar = title WHERE language = 'ar' AND title_ar IS NULL;
UPDATE public.stories SET title_te = title WHERE language = 'te' AND title_te IS NULL;

-- Backfill story_pages based on parent story's language
UPDATE public.story_pages sp
SET text_en = sp.text
FROM public.stories s
WHERE sp.story_id = s.id AND s.language = 'en' AND sp.text_en IS NULL;

UPDATE public.story_pages sp
SET text_ar = sp.text
FROM public.stories s
WHERE sp.story_id = s.id AND s.language = 'ar' AND sp.text_ar IS NULL;

UPDATE public.story_pages sp
SET text_te = sp.text
FROM public.stories s
WHERE sp.story_id = s.id AND s.language = 'te' AND sp.text_te IS NULL;