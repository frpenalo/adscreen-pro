-- Explicit player heartbeat
-- The player pings every 60s, independent of ad impressions, so we
-- can distinguish "TV is on but has no ads" from "TV is off".

alter table public.partners
  add column if not exists last_seen_at timestamptz;

create index if not exists partners_last_seen_idx
  on public.partners(last_seen_at);

-- Public RPC: anyone (including the anon player) can update the
-- heartbeat for a given screen id. SECURITY DEFINER lets it bypass
-- RLS but we only allow updating the timestamp for a valid uuid.
create or replace function public.ping_screen(screen_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partners
     set last_seen_at = now()
   where id = screen_id;
end;
$$;

-- Grant execute to the anon and authenticated roles
grant execute on function public.ping_screen(uuid) to anon, authenticated;
