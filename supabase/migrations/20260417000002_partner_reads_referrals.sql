-- Partners need to read advertisers they referred in order to show
-- the referrals list in their dashboard. The existing policy only
-- allows advertisers to read their own record and admins to read all.
CREATE POLICY "Partner reads own referrals" ON public.advertisers
  FOR SELECT USING (referred_partner_id = auth.uid() AND public.is_partner());
