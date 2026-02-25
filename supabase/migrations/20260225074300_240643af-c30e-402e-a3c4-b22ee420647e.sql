
-- Stories: open SELECT and UPDATE to all authenticated users
DROP POLICY "Users can view own stories" ON public.stories;
CREATE POLICY "Authenticated users can view all stories"
  ON public.stories FOR SELECT TO authenticated
  USING (true);

DROP POLICY "Users can update own stories" ON public.stories;
CREATE POLICY "Authenticated users can update all stories"
  ON public.stories FOR UPDATE TO authenticated
  USING (true);

-- Story pages: open all operations to authenticated users
DROP POLICY "Users can view own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can view all story pages"
  ON public.story_pages FOR SELECT TO authenticated
  USING (true);

DROP POLICY "Users can update own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can update all story pages"
  ON public.story_pages FOR UPDATE TO authenticated
  USING (true);

DROP POLICY "Users can create own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can create all story pages"
  ON public.story_pages FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY "Users can delete own story pages" ON public.story_pages;
CREATE POLICY "Authenticated users can delete all story pages"
  ON public.story_pages FOR DELETE TO authenticated
  USING (true);
