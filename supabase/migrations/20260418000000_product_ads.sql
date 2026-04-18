-- Add 'product' to ad_type enum
ALTER TYPE public.ad_type ADD VALUE IF NOT EXISTS 'product';

-- Allow advertiser_id to be NULL for system-generated product ads
ALTER TABLE public.ads ALTER COLUMN advertiser_id DROP NOT NULL;

-- Allow anyone (including unauthenticated PlayerPage) to read published ads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ads'
      AND policyname = 'Public reads published ads'
  ) THEN
    EXECUTE 'CREATE POLICY "Public reads published ads" ON public.ads
      FOR SELECT USING (status = ''published'')';
  END IF;
END $$;
