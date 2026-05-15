CREATE OR REPLACE FUNCTION public.get_story_page_counts(story_ids uuid[])
RETURNS TABLE(story_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT story_id, COUNT(*)::bigint
  FROM public.story_pages
  WHERE story_id = ANY(story_ids)
  GROUP BY story_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_story_page_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_story_page_counts(uuid[]) TO authenticated;