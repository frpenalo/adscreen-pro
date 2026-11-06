-- ── Log de dispatches de render (generate-ad-video) ─────────────────────────
--
-- La edge function generate-ad-video era pública sin auth ni rate limit:
-- cualquiera con la URL podía disparar renders facturables ilimitados en
-- GitHub Actions (auditoría 12 jul 2026). El fix agrega auth + ownership +
-- rate limit en la función; esta tabla es el respaldo DB del límite (máx 3
-- dispatches por advertiser/24h) — mismo patrón DB-backed que los contadores
-- de transform-selfie, pero con tabla propia porque el re-render reusa el
-- mismo ad_id y contar filas de ads no captura dispatches repetidos.
--
-- on delete cascade: cuando el cliente borra el ad huérfano tras un dispatch
-- fallido (CreateAdScreen), el cupo se devuelve solo.

create table if not exists render_dispatches (
  id            uuid primary key default gen_random_uuid(),
  ad_id         uuid not null references ads(id) on delete cascade,
  advertiser_id uuid not null,
  created_at    timestamptz not null default now()
);

create index if not exists render_dispatches_advertiser_created_idx
  on render_dispatches(advertiser_id, created_at);

-- RLS activo sin policies: solo el service role (la edge function) lee y
-- escribe. Ni anon ni authenticated tienen acceso.
alter table render_dispatches enable row level security;
