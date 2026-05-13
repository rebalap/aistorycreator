CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_updated_at ON public.stories(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_logs_user_story ON public.generation_logs(user_id, story_id);