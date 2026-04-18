-- Add tv_owner column to partners table
-- 'partner' = partner owns their own TV
-- 'adscreenpro' = AdScreenPro provides the TV
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS tv_owner TEXT NOT NULL DEFAULT 'partner'
  CHECK (tv_owner IN ('partner', 'adscreenpro'));
