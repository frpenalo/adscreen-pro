
-- Storage bucket for Shopify CSV imports
INSERT INTO storage.buckets (id, name, public) VALUES ('shopify-csv', 'shopify-csv', false);

CREATE POLICY "Admin uploads shopify csv"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'shopify-csv' AND public.is_admin());

CREATE POLICY "Admin reads shopify csv"
ON storage.objects FOR SELECT
USING (bucket_id = 'shopify-csv' AND public.is_admin());
