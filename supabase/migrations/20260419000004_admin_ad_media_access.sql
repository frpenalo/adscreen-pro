-- Allow admins to INSERT and UPDATE objects anywhere in the ad-media bucket.
-- The original policy only lets advertisers upload inside a folder named
-- after their own UUID, which blocks admin-driven flows that store media
-- under non-user folders (e.g. products/, sales-templates/, partner-qr/).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin uploads to ad-media'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admin uploads to ad-media"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'ad-media' AND public.is_admin())
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin updates ad-media'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admin updates ad-media"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'ad-media' AND public.is_admin())
      WITH CHECK (bucket_id = 'ad-media' AND public.is_admin())
    $p$;
  END IF;
END $$;
