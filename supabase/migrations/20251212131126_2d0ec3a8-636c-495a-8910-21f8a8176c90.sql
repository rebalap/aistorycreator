-- Stories table: metadata for each story
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Story',
  cover_image_url TEXT,
  character_image_url TEXT,
  background_image_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Story pages table: individual pages within a story
CREATE TABLE public.story_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, page_number)
);

-- Enable RLS on both tables
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_pages ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only CRUD their own stories
CREATE POLICY "Users can view own stories" ON public.stories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stories" ON public.stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Story pages inherit access from parent story
CREATE POLICY "Users can view own story pages" ON public.story_pages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own story pages" ON public.story_pages FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own story pages" ON public.story_pages FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own story pages" ON public.story_pages FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid()));

-- Storage bucket for story images
INSERT INTO storage.buckets (id, name, public) VALUES ('story-images', 'story-images', true);

-- RLS for storage: users can upload/manage their own images
CREATE POLICY "Users can upload story images" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'story-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view story images" ON storage.objects FOR SELECT 
  USING (bucket_id = 'story-images');
CREATE POLICY "Users can delete own images" ON storage.objects FOR DELETE 
  USING (bucket_id = 'story-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_story_pages_updated_at
  BEFORE UPDATE ON public.story_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();