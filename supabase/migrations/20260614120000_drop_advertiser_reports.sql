-- ── Limpieza: reportes mensuales redundantes ────────────────────────────────
--
-- El reporte de ROI del advertiser ahora se genera EN VIVO en el cliente
-- (ReportsScreen + jsPDF, descarga PDF bajo demanda), usando las queries que
-- el advertiser ya puede hacer por RLS sobre ad_logs y coupon_claims. Eso
-- reemplazó al flujo viejo de email (Resend) que nunca se conectó.
--
-- Por lo tanto el cron mensual + la edge function send-monthly-reports + la
-- tabla advertiser_reports quedaron redundantes. Esta migración limpia el cron
-- y la tabla. La edge function se borra aparte (repo + supabase functions
-- delete). Defensivo: si el cron no existe, no rompe la migración.

DO $$
BEGIN
  PERFORM cron.unschedule('monthly-advertiser-reports');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job monthly-advertiser-reports no existe — skip';
END $$;

DROP TABLE IF EXISTS public.advertiser_reports;
