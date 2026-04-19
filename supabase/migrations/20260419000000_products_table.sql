-- Products table: admin-managed product catalog for partner TV ads.
-- Each product has a custom image/video creative uploaded by the admin.
-- Publishing a product inserts one ad per approved partner with their
-- GoAffPro affiliate QR pointing to the Shopify product page.

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  shopify_handle TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  published_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Only admins manage products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Admin manages products'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin manages products" ON public.products
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- Index for fast lookup by shopify_handle
CREATE INDEX IF NOT EXISTS products_shopify_handle_idx ON public.products (shopify_handle);
