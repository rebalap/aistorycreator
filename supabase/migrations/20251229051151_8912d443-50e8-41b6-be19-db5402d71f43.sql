-- Create generation_logs table to track AI generation usage
CREATE TABLE public.generation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('page', 'cover', 'edit_page', 'edit_cover')),
  story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient user queries
CREATE INDEX idx_generation_logs_user_id ON public.generation_logs(user_id);
CREATE INDEX idx_generation_logs_created_at ON public.generation_logs(created_at);

-- Enable Row Level Security
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own generation logs
CREATE POLICY "Users can view own generation logs"
ON public.generation_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own generation logs
CREATE POLICY "Users can insert own generation logs"
ON public.generation_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);