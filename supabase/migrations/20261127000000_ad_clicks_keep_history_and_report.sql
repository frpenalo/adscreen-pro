-- ── Escaneos: historial que sobrevive al anuncio + reporte para Regalove ─────
--
-- 1. ad_clicks.ad_id tenía ON DELETE CASCADE. publish-product-ad borra y recrea
--    los ads de un producto cada vez que se republica, y retirar un producto
--    también los borra: con el cascade se perdía todo el historial de escaneos.
--    Ahora el escaneo guarda el handle del producto y el código del partner, y
--    al borrarse el ad queda con ad_id NULL en vez de desaparecer.
--
-- 2. El handle y el código los llena un trigger leyendo el ad, no el cliente:
--    la página /r/ es pública y no se le confía ese dato.
--
-- 3. escaneos_por_dia() agrega por día (hora del Este), producto y pantalla.
--    Solo la ejecuta service_role (edge function `escaneos`); ni anon ni
--    authenticated pueden llamarla.

alter table ad_clicks
  add column if not exists shopify_handle text,
  add column if not exists ref_code text;

alter table ad_clicks alter column ad_id drop not null;

alter table ad_clicks drop constraint if exists ad_clicks_ad_id_fkey;
alter table ad_clicks
  add constraint ad_clicks_ad_id_fkey
  foreign key (ad_id) references ads(id) on delete set null;

create or replace function fill_ad_click_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _meta jsonb;
begin
  new.shopify_handle := null;
  new.ref_code := null;
  if new.ad_id is not null then
    select metadata into _meta from ads where id = new.ad_id;
    new.shopify_handle := nullif(_meta->>'shopify_handle', '');
    new.ref_code := nullif(_meta->>'ref_code', '');
  end if;
  return new;
end;
$$;

drop trigger if exists ad_click_product_trigger on ad_clicks;
create trigger ad_click_product_trigger
  before insert on ad_clicks
  for each row execute function fill_ad_click_product();

-- Escaneos anteriores a esta migración cuyo ad todavía existe.
update ad_clicks c
set shopify_handle = nullif(a.metadata->>'shopify_handle', ''),
    ref_code = nullif(a.metadata->>'ref_code', '')
from ads a
where a.id = c.ad_id
  and c.shopify_handle is null
  and a.metadata->>'shopify_handle' is not null;

create index if not exists ad_clicks_handle_created_idx
  on ad_clicks(shopify_handle, created_at)
  where shopify_handle is not null;

create or replace function escaneos_por_dia(p_desde date, p_hasta date)
returns table (
  fecha date,
  handle text,
  pantalla_id text,
  "local" text,
  codigo_partner text,
  escaneos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (c.created_at at time zone 'America/New_York')::date as fecha,
    c.shopify_handle as handle,
    c.screen_id as pantalla_id,
    max(p.business_name) as "local",
    max(c.ref_code) as codigo_partner,
    count(*) as escaneos
  from ad_clicks c
  left join partners p on p.id::text = c.screen_id
  where c.shopify_handle is not null
    and (c.created_at at time zone 'America/New_York')::date between p_desde and p_hasta
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

revoke all on function escaneos_por_dia(date, date) from public;
revoke all on function escaneos_por_dia(date, date) from anon, authenticated;
grant execute on function escaneos_por_dia(date, date) to service_role;
