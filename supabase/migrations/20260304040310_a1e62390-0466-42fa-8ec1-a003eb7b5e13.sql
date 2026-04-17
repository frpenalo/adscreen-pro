
-- Create storage bucket for ad media
INSERT INTO storage.buckets (id, name, public) VALUES ('ad-media', 'ad-media', true);

-- Advertisers can upload to their own folder
CREATE POLICY "Advertiser uploads own media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ad-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Advertisers can read their own media
CREATE POLICY "Advertiser reads own media"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

-- Advertisers can delete their own media
CREATE POLICY "Advertiser deletes own media"
ON storage.objects FOR DELETE
USING (bucket_id = 'ad-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

-- Create storage bucket for brand assets (logos)
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true);

CREATE POLICY "Advertiser uploads brand assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Advertiser reads brand assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "Advertiser deletes brand assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'brand-assets' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));
