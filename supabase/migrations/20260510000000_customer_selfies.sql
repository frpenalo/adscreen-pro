-- Customer-selfie filler ads.
--
-- Customer in the partner barbershop scans a QR shown on the TV,
-- takes a selfie, picks a transformation style (peluche, action
-- figure, anime, etc.), and the AI-generated result appears as
-- filler content between regular ads. Auto-expires after 8h.
-- Surprise mode: customer never previews — the reveal happens on
-- the TV, which generates the social-media moment.
--
-- Reuses the existing `ads` table with a new `kind` column to
-- distinguish selfies from real ads — the player's existing fetch
-- + rotation logic Just Works once the new column is filtered in.

-- ── Schema ──────────────────────────────────────────────────────────────────
alter table public.ads
  add column if not exists kind          text        not null default 'ad',
  add column if not exists expires_at    timestamptz,
  add column if not exists customer_name text,
  add column if not exists style         text;

-- Index for the player's filter "active selfies for this screen".
-- Partial index: expires_at is null for the vast majority of rows
-- (real ads), so a regular btree would be wasteful.
create index if not exists ads_selfie_active_idx
  on public.ads (screen_id, expires_at)
  where kind = 'selfie';

-- Rate-limit helper indexes — used by the transform-selfie edge
-- function to check per-fingerprint and per-IP quotas before paying
-- OpenAI for a transformation.
create index if not exists ads_selfie_fp_idx
  on public.ads (created_at)
  where kind = 'selfie' and (metadata ->> 'fp') is not null;

create index if not exists ads_selfie_ip_idx
  on public.ads (created_at)
  where kind = 'selfie' and (metadata ->> 'ip') is not null;

-- ── RLS: anonymous player can read active selfies ──────────────────────────
-- The player runs unauthenticated and needs to fetch selfies the
-- same way it fetches ads. Real ads have their own select policy
-- already; this OR-extends visibility for selfies that are still
-- valid.
drop policy if exists "anon can read active selfies" on public.ads;
create policy "anon can read active selfies"
  on public.ads
  for select
  to anon, authenticated
  using (
    kind = 'selfie'
    and status = 'published'
    and (expires_at is null or expires_at > now())
  );

-- NOTE: anon INSERT is NOT granted via RLS. Selfie creation goes
-- exclusively through the transform-selfie edge function which uses
-- service_role — that's where we enforce rate limits server-side
-- BEFORE paying for AI generation.

-- ── Storage: anonymous read of selfies/ prefix ─────────────────────────────
-- Same bucket as ads (`ad-media`). The actual upload is done by the
-- edge function via service_role; we only need a read policy for
-- the player to fetch the public URLs.
drop policy if exists "public can read selfies" on storage.objects;
create policy "public can read selfies"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'ad-media'
    and (storage.foldername(name))[1] = 'selfies'
  );

-- ── Cleanup helper ─────────────────────────────────────────────────────────
-- Hard-delete selfies that expired more than an hour ago, to keep
-- the ads table small. Called by a cron (separate setup). Storage
-- objects get cleaned up by a different cron.
create or replace function public.purge_expired_selfies()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count int;
begin
  delete from public.ads
   where kind = 'selfie'
     and expires_at is not null
     and expires_at < now() - interval '1 hour';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.purge_expired_selfies() to service_role;
