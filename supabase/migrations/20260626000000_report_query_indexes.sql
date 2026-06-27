-- ── Índices compuestos para las queries del reporte del advertiser ──────────
--
-- El reporte (ReportsScreen) filtra por DOS columnas a la vez:
--   • ad_logs:       ad_id IN (...)  AND  created_at >= mes < mes+1
--   • coupon_claims: coupon_id IN (...) AND claimed_at >= mes < mes+1
--
-- Ya existían índices de una sola columna (ad_logs_ad_id_idx, created_at_idx;
-- coupon_claims_coupon_idx), pero cada uno resuelve solo la mitad del filtro.
-- Un índice compuesto (columna_id, columna_fecha) resuelve ambas partes de un
-- tiro: a escala (millones de impresiones) la diferencia es grande.
--
-- Los índices simples por la columna id quedan SUBSUMIDOS por el compuesto
-- (mismo prefijo), así que se eliminan para no pagar doble escritura. El índice
-- de ad_logs solo por created_at se conserva (sirve a queries sin ad_id).

-- ad_logs: (ad_id, created_at)
CREATE INDEX IF NOT EXISTS ad_logs_ad_created_idx
  ON public.ad_logs (ad_id, created_at);
DROP INDEX IF EXISTS public.ad_logs_ad_id_idx;

-- coupon_claims: (coupon_id, claimed_at)
CREATE INDEX IF NOT EXISTS coupon_claims_coupon_time_idx
  ON public.coupon_claims (coupon_id, claimed_at);
DROP INDEX IF EXISTS public.coupon_claims_coupon_idx;
