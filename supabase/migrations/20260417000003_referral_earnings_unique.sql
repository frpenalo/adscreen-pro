-- Unique constraint to prevent double-counting commissions
-- if the Stripe webhook fires more than once for the same invoice.
ALTER TABLE partner_referral_earnings_manual
  ADD CONSTRAINT referral_earnings_unique
  UNIQUE (partner_id, advertiser_id, month);
