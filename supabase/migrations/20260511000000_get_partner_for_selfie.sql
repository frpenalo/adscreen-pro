-- Public RPC for the SelfiePage to look up a partner by screenId
-- without needing the customer to be authenticated.
--
-- Background: SelfiePage runs as anonymous (the customer scanning
-- the QR is a random person, not logged in). It needs to display
-- the business name and verify the partner is approved before
-- letting the customer pick a style.
--
-- The existing RLS policy on partners that allows reading approved
-- ones is restricted to `roles = {authenticated}`. Result: anon
-- query returns null, SelfiePage shows "Pantalla no encontrada"
-- even for valid approved partners.
--
-- Rather than open the entire partners row to anon (which would
-- leak contact_email, contact_phone, goaffpro_referral_link, and
-- other sensitive fields), expose ONLY the two columns the
-- SelfiePage needs through a SECURITY DEFINER function.

create or replace function public.get_partner_for_selfie(p_id uuid)
returns table (business_name text, status text)
language sql
security definer
set search_path = public
as $$
  select business_name, status::text
    from partners
   where id = p_id;
$$;

grant execute on function public.get_partner_for_selfie(uuid) to anon, authenticated;
