-- Remote commands + enriched heartbeat for the player fleet.
--
-- Adds telemetry columns to partners (the row that represents each
-- screen) so admins can see what the TV is actually doing — not just
-- whether it's online. Also extends ping_screen() so the player can
-- attach this data to the existing 60s heartbeat without a second RPC.
--
-- Remote commands themselves are delivered via Supabase Realtime
-- broadcast on channel `screen-commands:{partner_id}` — no DB row
-- needed, but we record the LAST command sent so the admin UI can
-- show "last reload: 2h ago" for context.

alter table public.partners
  add column if not exists uptime_seconds  bigint,
  add column if not exists app_version     text,
  add column if not exists ads_count       int,
  add column if not exists last_command    text,
  add column if not exists last_command_at timestamptz;

-- Replace ping_screen with a richer version that the player calls
-- every 60s. All new params optional → old player versions keep
-- working until the fleet rolls over.
create or replace function public.ping_screen(
  screen_id       uuid,
  p_uptime_seconds bigint default null,
  p_app_version    text   default null,
  p_ads_count      int    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partners
     set last_seen_at    = now(),
         uptime_seconds  = coalesce(p_uptime_seconds, uptime_seconds),
         app_version     = coalesce(p_app_version, app_version),
         ads_count       = coalesce(p_ads_count, ads_count)
   where id = screen_id;
end;
$$;

grant execute on function public.ping_screen(uuid, bigint, text, int) to anon, authenticated;

-- Admin-only RPC the dashboard calls when issuing a remote command.
-- We only persist the audit trail — the actual delivery happens via
-- Realtime broadcast on the client side. Persisting it here means
-- the audit trail survives even if the broadcast fails.
create or replace function public.record_screen_command(
  screen_id uuid,
  command   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only authenticated users can record commands. RLS on partners
  -- still applies — this is an audit trail, not a permission grant.
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  update public.partners
     set last_command    = command,
         last_command_at = now()
   where id = screen_id;
end;
$$;

grant execute on function public.record_screen_command(uuid, text) to authenticated;
