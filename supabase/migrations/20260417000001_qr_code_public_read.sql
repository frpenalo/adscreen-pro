-- QR referral codes need to be readable by any authenticated user.
-- When an advertiser registers via a partner's QR link, AuthRedirect looks up
-- the code to get the partner_id. The old policy only allowed the partner owner
-- to read their own code, so the lookup returned null and the referral was lost.
DROP POLICY IF EXISTS "Partner reads own qr" ON public.partner_qr_codes;

CREATE POLICY "Partner reads own qr" ON public.partner_qr_codes
  FOR SELECT USING (partner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Authenticated users can look up qr by code" ON public.partner_qr_codes
  FOR SELECT TO authenticated USING (true);
