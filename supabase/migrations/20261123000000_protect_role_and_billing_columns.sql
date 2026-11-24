-- ── Campos que el usuario no puede cambiar por su cuenta ─────────────────────
--
-- Las policies "Users update own profile" y "Advertiser updates own" dejan que
-- cada usuario edite su propia fila sin limitar columnas. Eso incluye campos
-- que deciden permisos y cobro: profiles.role (is_admin() lo lee) y, en
-- advertisers, is_active / activated_at / plan / ads_this_month /
-- last_month_reset / referred_partner_id (revisión de pagos 23-nov-2026).
--
-- Se resuelve con triggers que devuelven esos campos a su valor anterior en
-- vez de rechazar la operación: el cliente hace upsert de la fila completa
-- (AuthRedirect) y un RAISE rompería ese flujo.
--
-- Quién SÍ puede cambiarlos:
--   · service role (auth.uid() es NULL): stripe-webhook, demo-login.
--   · un admin (is_admin()).
--   · otro trigger (pg_trigger_depth() > 1): count_advertiser_ad y
--     refund_advertiser_ad actualizan ads_this_month dentro de la sesión del
--     propio anunciante.

-- ── profiles: rol y correo ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'admin' THEN
      NEW.role := 'advertiser';
    END IF;
    RETURN NEW;
  END IF;

  NEW.role  := OLD.role;
  NEW.email := OLD.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns ON public.profiles;
CREATE TRIGGER protect_profile_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ── advertisers: estado de pago, plan, contadores y referido ─────────────────
CREATE OR REPLACE FUNCTION public.protect_advertiser_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_active        := false;
    NEW.activated_at     := NULL;
    NEW.plan             := 'basico';
    NEW.ads_this_month   := 0;
    NEW.last_month_reset := CURRENT_DATE;
    RETURN NEW;
  END IF;

  NEW.is_active        := OLD.is_active;
  NEW.activated_at     := OLD.activated_at;
  NEW.plan             := OLD.plan;
  NEW.ads_this_month   := OLD.ads_this_month;
  NEW.last_month_reset := OLD.last_month_reset;
  -- El referido se fija una sola vez (al registrarse con el link de un
  -- partner); después no se puede reasignar.
  IF OLD.referred_partner_id IS NOT NULL THEN
    NEW.referred_partner_id := OLD.referred_partner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_advertiser_columns ON public.advertisers;
CREATE TRIGGER protect_advertiser_columns
  BEFORE INSERT OR UPDATE ON public.advertisers
  FOR EACH ROW EXECUTE FUNCTION public.protect_advertiser_columns();
