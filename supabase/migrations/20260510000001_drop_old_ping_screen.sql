-- Drop the legacy ping_screen(uuid) overload.
--
-- The 20260505000000_screen_remote_commands migration added a richer
-- ping_screen(uuid, bigint, text, int) overload for the enriched
-- heartbeat (uptime, version, ads_count). PostgreSQL kept BOTH
-- versions, which made every TV's heartbeat fail silently with
-- "function ping_screen(uuid) is not unique" — supabase-js doesn't
-- throw on RPC errors, so the failure was invisible. Result: all 8
-- partners had last_seen_at = NULL despite TVs running and ads
-- displaying correctly.
--
-- The new function handles both clients (old bundles passing only
-- screen_id work fine because the extra params DEFAULT NULL), so
-- dropping the old one is non-breaking and restores heartbeat for
-- the entire fleet.

drop function if exists public.ping_screen(uuid);
