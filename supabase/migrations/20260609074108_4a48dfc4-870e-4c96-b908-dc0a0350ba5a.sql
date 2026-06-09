DROP POLICY IF EXISTS "Users can update own stories" ON public.stories;
CREATE POLICY "Authenticated users can update all stories" ON public.stories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can update all story pages" ON public.story_pages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can create own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can create story pages" ON public.story_pages
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can delete story pages" ON public.story_pages
  FOR DELETE TO authenticated USING (true);