-- One-off cleanup: two ads uploaded by advertiser "Cristo Rey Films"
-- (advertiser_id 693c042e-6d56-4ac1-b833-da77e1bef6c4) carry a QR
-- burned into the media file itself that points to the wrong partner.
-- Reject them so they stop rotating on every TV. Advertiser will need
-- to re-upload without an embedded QR.
UPDATE public.ads
SET
  status = 'rejected',
  rejected_reason = 'QR incrustado en la creatividad apunta a un partner incorrecto. Resube sin QR; el sistema agrega el QR automáticamente.'
WHERE id IN (
  'e755b1d5-5f7a-43b5-b3a4-eb9e932e1803',
  '107ad3ad-70e6-4c45-9793-4275e5482806'
);
