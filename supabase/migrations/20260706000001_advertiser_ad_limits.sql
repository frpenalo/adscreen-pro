-- ── Cupo mensual de anuncios por advertiser ──────────────────────────────────
--
-- CreateAdScreen siempre leyó plan / ads_this_month / last_month_reset para
-- calcular el cupo, pero LAS COLUMNAS NUNCA EXISTIERON: el contador siempre
-- era undefined → 0 usados → cupo infinito (auditoría 6 jul 2026). Esta
-- migración crea las columnas y el contador server-side.
--
-- El conteo vive en un trigger (no en el cliente) para que no se pueda
-- saltar. Solo cuenta inserts hechos POR el propio advertiser autenticado
-- (auth.uid() = advertiser_id): los selfies (service role, auth.uid() NULL)
-- y los ads que inserta el admin para un cliente NO consumen cupo.

ALTER TABLE public.advertisers
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS ads_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_month_reset date NOT NULL DEFAULT CURRENT_DATE;

-- Incrementa el contador al crear un ad; resetea si cambió el mes.
CREATE OR REPLACE FUNCTION public.count_advertiser_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.advertiser_id THEN
    UPDATE public.advertisers
    SET ads_this_month = CASE
          WHEN date_trunc('month', last_month_reset) < date_trunc('month', CURRENT_DATE)
          THEN 1
          ELSE ads_this_month + 1
        END,
        last_month_reset = CASE
          WHEN date_trunc('month', last_month_reset) < date_trunc('month', CURRENT_DATE)
          THEN CURRENT_DATE
          ELSE last_month_reset
        END
    WHERE id = NEW.advertiser_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS count_advertiser_ad_on_insert ON public.ads;
CREATE TRIGGER count_advertiser_ad_on_insert
  AFTER INSERT ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.count_advertiser_ad();

-- Devuelve el cupo cuando el advertiser borra un DRAFT del mes en curso.
-- Cubre el caso "el dispatch del render falló y borramos el ad huérfano" sin
-- castigar al cliente. Ads ya aprobados/publicados no devuelven cupo (ya
-- salieron al aire), así que borrar-y-recrear no regala anuncios.
CREATE OR REPLACE FUNCTION public.refund_advertiser_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = OLD.advertiser_id
     AND OLD.status = 'draft'
     AND date_trunc('month', OLD.created_at) = date_trunc('month', CURRENT_DATE) THEN
    UPDATE public.advertisers
    SET ads_this_month = GREATEST(0, ads_this_month - 1)
    WHERE id = OLD.advertiser_id
      AND date_trunc('month', last_month_reset) = date_trunc('month', CURRENT_DATE);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS refund_advertiser_ad_on_delete ON public.ads;
CREATE TRIGGER refund_advertiser_ad_on_delete
  AFTER DELETE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.refund_advertiser_ad();
