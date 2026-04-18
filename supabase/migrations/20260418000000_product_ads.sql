-- Add 'product' to ad_type enum
ALTER TYPE public.ad_type ADD VALUE IF NOT EXISTS 'product';

-- Allow advertiser_id to be NULL for system-generated product ads
ALTER TABLE public.ads ALTER COLUMN advertiser_id DROP NOT NULL;

-- Allow anyone (including unauthenticated PlayerPage) to read published ads
CREATE POLICY IF NOT EXISTS "Public reads published ads" ON public.ads
  FOR SELECT USING (status = 'published');
