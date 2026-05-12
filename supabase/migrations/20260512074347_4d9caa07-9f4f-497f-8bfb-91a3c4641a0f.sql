DROP POLICY IF EXISTS "Authenticated users can update all stories" ON public.stories;
DROP POLICY IF EXISTS "Authenticated users can delete all stories" ON public.stories;
DROP POLICY IF EXISTS "Users can update own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete own stories" ON public.stories;

CREATE POLICY "Users can update own stories"
  ON public.stories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON public.stories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create all story pages" ON public.story_pages;
DROP POLICY IF EXISTS "Authenticated users can update all story pages" ON public.story_pages;
DROP POLICY IF EXISTS "Authenticated users can delete all story pages" ON public.story_pages;
DROP POLICY IF EXISTS "Users can create own story pages" ON public.story_pages;
DROP POLICY IF EXISTS "Users can update own story pages" ON public.story_pages;
DROP POLICY IF EXISTS "Users can delete own story pages" ON public.story_pages;

CREATE POLICY "Users can create own story pages"
  ON public.story_pages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()));

CREATE POLICY "Users can update own story pages"
  ON public.story_pages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete own story pages"
  ON public.story_pages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()));