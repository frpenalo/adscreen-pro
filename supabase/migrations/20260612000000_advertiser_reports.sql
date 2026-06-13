-- ── Reportes mensuales automáticos para advertisers ─────────────────────────
--
-- Antichurn #1: demostrar ROI cada mes sin que lo pidan. La edge function
-- send-monthly-reports agrega impresiones (ad_logs) + cupones (coupon_claims)
-- del mes anterior por advertiser, guarda el reporte acá y lo envía por
-- email (Resend). pg_cron la invoca el día 1 de cada mes.

CREATE TABLE public.advertiser_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  -- Snapshot completo del reporte (impresiones totales, por ad, pantallas,
  -- cupones). JSONB para no migrar el schema cada vez que agreguemos métricas.
  payload jsonb NOT NULL,
  emailed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un reporte por advertiser por periodo — hace idempotente a la edge
-- function: re-invocarla no duplica reportes ni re-envía emails.
CREATE UNIQUE INDEX advertiser_reports_period_unique
  ON public.advertiser_reports (advertiser_id, period_start);

ALTER TABLE public.advertiser_reports ENABLE ROW LEVEL SECURITY;

-- El advertiser lee sus propios reportes (para mostrarlos en el dashboard).
-- Solo la edge function (service role) inserta/actualiza.
CREATE POLICY "Advertiser reads own reports" ON public.advertiser_reports
  FOR SELECT
  USING (advertiser_id = auth.uid() OR public.is_admin());

-- ── Cron mensual ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Día 1 de cada mes a las 13:00 UTC (~9am ET). El anon key es público por
-- diseño (vive en el bundle del frontend). x-report-key autentica el trigger;
-- aun si se filtrara, la función es idempotente (unique index arriba) — lo
-- único que permite es adelantar el envío del mes.
SELECT cron.schedule(
  'monthly-advertiser-reports',
  '0 13 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://qrlzbveaoibyidpwlwmz.supabase.co/functions/v1/send-monthly-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybHpidmVhb2lieWlkcHdsd216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTAzODksImV4cCI6MjA4ODE2NjM4OX0.wN5HYwqZikmmlGZP5U4rWMiHRNe13VdYVfARf9rTkDQ',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybHpidmVhb2lieWlkcHdsd216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTAzODksImV4cCI6MjA4ODE2NjM4OX0.wN5HYwqZikmmlGZP5U4rWMiHRNe13VdYVfARf9rTkDQ',
      'x-report-key', '36e16592966686cd9a80a28fb4ffaac69f42146cd6042abe'
    ),
    body := '{}'::jsonb
  );
  $$
);
