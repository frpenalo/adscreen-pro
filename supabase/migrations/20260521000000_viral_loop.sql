-- Sprint 1 — "Viral Loop" backend support.
--
-- Adds the columns + RPC needed for the customer-side post-AI
-- experience (branded card with title + share buttons + CTA to
-- booking/Instagram) and the TV-side cinematic reveal.

-- ── 1. customer_title on ads ────────────────────────────────────────
-- Dramatic title attached to each selfie (e.g. "MAIN CHARACTER",
-- "ULTRA RARE", "FADE KING"). Set by the transform-selfie edge
-- function at creation time, picked randomly from a per-style pool.
-- Shown on the branded card, on the TV during the cinematic reveal,
-- and pre-filled in the share text. Nullable for backward
-- compatibility with existing rows.
alter table public.ads
  add column if not exists customer_title text;

-- ── 2. booking_url + instagram_handle on partners ───────────────────
-- Optional links used by the customer-side CTAs on the result screen:
--   "Reserva tu próximo corte" → booking_url
--   "Sigue a @business en IG"  → instagram_handle (without @)
-- Partners that haven't filled these in just don't see the CTA — no
-- broken links, no placeholder noise. Admin fills via the existing
-- partner edit dialog (separate UI work in a follow-up).
alter table public.partners
  add column if not exists booking_url       text,
  add column if not exists instagram_handle  text;

-- ── 3. RPC: get_selfie_status ────────────────────────────────────────
-- Public endpoint the customer's phone polls to detect when the AI
-- background generation finished. Returns minimal fields needed for
-- the result screen — never exposes anything sensitive.
-- Customers are anon (random scanners), so we need a SECURITY DEFINER
-- RPC: a direct table SELECT would be blocked by RLS.
create or replace function public.get_selfie_status(p_ad_id uuid)
returns table (
  status              text,
  final_media_path    text,
  customer_name       text,
  customer_title      text,
  style               text,
  business_name       text,
  booking_url         text,
  instagram_handle    text
)
language sql
security definer
set search_path = public
as $$
  select
    a.status::text,
    a.final_media_path,
    a.customer_name,
    a.customer_title,
    a.style,
    p.business_name,
    p.booking_url,
    p.instagram_handle
  from ads a
  -- ads.screen_id is text; partners.id is uuid. Cast required for join.
  left join partners p on p.id::text = a.screen_id
  where a.id = p_ad_id
    and a.kind = 'selfie';
$$;

grant execute on function public.get_selfie_status(uuid) to anon, authenticated;
