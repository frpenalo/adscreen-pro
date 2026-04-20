-- Admin can insert ads directly (needed for filler content feature
-- where admin uploads house creative that rotates on all screens).
-- The existing 'Advertiser inserts own ads' policy only allows rows
-- where advertiser_id = auth.uid() AND is_advertiser(), so admins
-- with advertiser_id = NULL need their own policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ads'
      AND policyname = 'Admin inserts ads'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin inserts ads" ON public.ads
      FOR INSERT WITH CHECK (public.is_admin())';
  END IF;
END $$;
