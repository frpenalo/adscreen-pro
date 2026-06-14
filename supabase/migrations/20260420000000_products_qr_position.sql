-- products_qr_position — Admin-selectable QR placement per product.
--
-- Before this migration the QR was hard-coded to bottom-right at ~12% of the
-- media's shorter dimension. Now each product stores its own placement so the
-- admin can click anywhere on the creative and pick a custom size per art.
--
-- Coordinates:
--   qr_x / qr_y        decimals in [0, 1], CENTER of the QR box as a fraction
--                      of the media's width / height respectively.
--   qr_size_pct        decimal in [0.05, 0.30], QR side length as a fraction
--                      of the media's shorter dimension (same convention
--                      PlayerPage already uses for computing qrSize).
--
-- Defaults (0.88 / 0.88 / 0.12) reproduce the previous hard-coded
-- bottom-right placement so existing products render identically until the
-- admin opens the picker and changes them.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS qr_x NUMERIC(4,3) NOT NULL DEFAULT 0.880,
  ADD COLUMN IF NOT EXISTS qr_y NUMERIC(4,3) NOT NULL DEFAULT 0.880,
  ADD COLUMN IF NOT EXISTS qr_size_pct NUMERIC(4,3) NOT NULL DEFAULT 0.120;

ALTER TABLE public.products
  ADD CONSTRAINT products_qr_x_range   CHECK (qr_x BETWEEN 0 AND 1),
  ADD CONSTRAINT products_qr_y_range   CHECK (qr_y BETWEEN 0 AND 1),
  ADD CONSTRAINT products_qr_size_rng  CHECK (qr_size_pct BETWEEN 0.03 AND 0.40);

COMMENT ON COLUMN public.products.qr_x IS
  'QR center X coordinate as fraction [0,1] of media width. 0.5 = horizontal center.';
COMMENT ON COLUMN public.products.qr_y IS
  'QR center Y coordinate as fraction [0,1] of media height. 0.5 = vertical center.';
COMMENT ON COLUMN public.products.qr_size_pct IS
  'QR side length as fraction of media shorter dimension. Typical 0.08–0.20.';
