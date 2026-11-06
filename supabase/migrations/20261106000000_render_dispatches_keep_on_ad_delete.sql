-- ── render_dispatches: el registro sobrevive al borrado del ad ───────────────
--
-- Con "on delete cascade", borrar el ad borraba también su registro de
-- dispatch y devolvía el cupo de 3 renders/24h. Como un advertiser puede
-- borrar sus propios ads, el ciclo crear → disparar render → borrar repetía
-- renders facturables en GitHub Actions sin tope (el contador mensual de ads
-- también se devuelve al borrar un borrador).
--
-- El cupo de un dispatch que nunca arrancó ya lo devuelve la edge function
-- generate-ad-video borrando la fila ella misma; el cascade no hacía falta
-- para eso. Un render que sí arrancó debe contar aunque el ad se borre.

alter table render_dispatches alter column ad_id drop not null;

alter table render_dispatches
  drop constraint if exists render_dispatches_ad_id_fkey;

alter table render_dispatches
  add constraint render_dispatches_ad_id_fkey
  foreign key (ad_id) references ads(id) on delete set null;
