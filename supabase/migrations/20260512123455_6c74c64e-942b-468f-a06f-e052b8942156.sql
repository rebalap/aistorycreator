ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS heygen_video_id text,
  ADD COLUMN IF NOT EXISTS video_generated_at timestamptz;