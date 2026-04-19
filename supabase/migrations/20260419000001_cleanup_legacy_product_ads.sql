-- Remove stale product ads from the old Shopify-pull flow.
-- Those rows have type='product' and were inserted by the previous
-- version of publish-product-ad. The new flow inserts rows with
-- type='image' or type='video' + metadata.product_id instead.
DELETE FROM public.ads WHERE type = 'product';
