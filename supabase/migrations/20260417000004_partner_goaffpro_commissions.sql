-- GoAffPro product sale commissions (10% per sale via referral link)
CREATE TABLE public.partner_goaffpro_commissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  order_id       TEXT NOT NULL,
  order_total_usd NUMERIC NOT NULL,
  commission_usd  NUMERIC NOT NULL,
  goaffpro_affiliate_id TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT goaffpro_commissions_order_unique UNIQUE (order_id)
);

ALTER TABLE public.partner_goaffpro_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner reads own goaffpro commissions"
  ON public.partner_goaffpro_commissions
  FOR SELECT USING (partner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Service role inserts goaffpro commissions"
  ON public.partner_goaffpro_commissions
  FOR INSERT WITH CHECK (true);
