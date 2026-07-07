-- ── Estado del render en los ads animados ────────────────────────────────────
--
-- Los ads con video generado (flujo "Mejorar con IA") se insertan en draft y
-- el MP4 llega después vía GitHub Actions. Hasta ahora no había forma de
-- distinguir "renderizando" de "el render murió": el ad quedaba en draft con
-- final_media_path='' para siempre y nadie se enteraba (auditoría 6 jul 2026).
--
-- render_status:
--   'rendering' — el advertiser envió; el workflow está corriendo (o en cola)
--   'done'      — el script de render subió el MP4 y actualizó el ad
--   'failed'    — el render murió; el script lo marca y notifica al admin
--   NULL        — ads que no pasan por render (subida directa, selfies, legacy)

ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS render_status text
  CHECK (render_status IS NULL OR render_status IN ('rendering', 'done', 'failed'));
