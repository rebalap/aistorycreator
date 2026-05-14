DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'story-images' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'story-images' AND (auth.uid())::text = (storage.foldername(name))[1]);