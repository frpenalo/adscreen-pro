-- Defensive cleanup: general ads (screen_id IS NULL) must never carry a
-- partner-specific QR. Any qr_url on a general ad is legacy data from
-- earlier tests and would render a wrong partner's QR on every TV.
UPDATE public.ads
SET qr_url = NULL
WHERE screen_id IS NULL
  AND qr_url IS NOT NULL;
