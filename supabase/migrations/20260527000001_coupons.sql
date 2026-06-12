-- ── Cupones digitales para advertisers ───────────────────────────────────────
--
-- Flujo: el ad del advertiser en la TV lleva un QR a /coupon/:id → el
-- cliente reclama y recibe un código único → lo muestra en el negocio →
-- el staff del advertiser lo canjea desde su dashboard.
--
-- Acceso:
--   coupons        → CRUD del advertiser dueño (+ admin). Lectura pública
--                    SOLO vía RPC get_public_coupon (activos, no expirados).
--   coupon_claims  → INSERT solo por edge function claim-coupon (service
--                    role, con anti-abuso fp+IP). El advertiser dueño lee
--                    sus claims (stats) y canjea vía RPC redeem_coupon_claim.

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 200),
  terms text CHECK (terms IS NULL OR char_length(terms) <= 300),
  expires_at timestamptz,
  max_claims integer CHECK (max_claims IS NULL OR max_claims > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertiser manages own coupons" ON public.coupons
  FOR ALL
  USING (advertiser_id = auth.uid() OR public.is_admin())
  WITH CHECK (advertiser_id = auth.uid() OR public.is_admin());

CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.coupon_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  device_fingerprint text NOT NULL,
  client_ip text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);

-- Un claim por dispositivo por cupón. La edge function detecta la violación
-- y devuelve el código existente (claim idempotente: re-escanear el QR
-- muestra el mismo código en vez de error).
CREATE UNIQUE INDEX coupon_claims_one_per_device
  ON public.coupon_claims (coupon_id, device_fingerprint);
CREATE INDEX coupon_claims_coupon_idx ON public.coupon_claims (coupon_id);
CREATE INDEX coupon_claims_ip_time_idx ON public.coupon_claims (client_ip, claimed_at);

ALTER TABLE public.coupon_claims ENABLE ROW LEVEL SECURITY;

-- El advertiser dueño del cupón lee los claims (stats de su dashboard).
-- Sin policy de INSERT/UPDATE/DELETE para usuarios: el INSERT lo hace la
-- edge function con service role y el canje va por RPC SECURITY DEFINER.
CREATE POLICY "Advertiser reads own coupon claims" ON public.coupon_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coupons c
      WHERE c.id = coupon_id
        AND (c.advertiser_id = auth.uid() OR public.is_admin())
    )
  );

-- ── RPC: lectura pública de UN cupón activo (para /coupon/:id) ──────────────
-- Mismo patrón que lookup_partner_by_ref_code: lookup exacto, sin listar la
-- tabla. Devuelve también el business_name para mostrar de quién es la oferta.
CREATE OR REPLACE FUNCTION public.get_public_coupon(p_coupon_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  terms text,
  expires_at timestamptz,
  business_name text,
  sold_out boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.description,
    c.terms,
    c.expires_at,
    a.business_name,
    (c.max_claims IS NOT NULL
      AND (SELECT count(*) FROM public.coupon_claims cc WHERE cc.coupon_id = c.id) >= c.max_claims
    ) AS sold_out
  FROM public.coupons c
  JOIN public.advertisers a ON a.id = c.advertiser_id
  WHERE c.id = p_coupon_id
    AND c.status = 'active'
    AND (c.expires_at IS NULL OR c.expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_coupon(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_coupon(uuid) TO anon, authenticated;

-- ── RPC: canje por código (staff del advertiser) ─────────────────────────────
-- Valida que el claim pertenezca a un cupón del advertiser autenticado.
-- Devuelve un estado discreto para que la UI muestre el mensaje correcto.
CREATE OR REPLACE FUNCTION public.redeem_coupon_claim(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim record;
BEGIN
  SELECT cc.id, cc.redeemed_at, c.title, c.advertiser_id
    INTO v_claim
  FROM public.coupon_claims cc
  JOIN public.coupons c ON c.id = cc.coupon_id
  WHERE upper(cc.code) = upper(trim(p_code))
  LIMIT 1;

  IF v_claim IS NULL OR (v_claim.advertiser_id <> auth.uid() AND NOT public.is_admin()) THEN
    -- Mismo mensaje si no existe o si es de otro advertiser — no filtrar
    -- la existencia de códigos ajenos.
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_claim.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_redeemed',
      'redeemed_at', v_claim.redeemed_at,
      'title', v_claim.title
    );
  END IF;

  UPDATE public.coupon_claims SET redeemed_at = now() WHERE id = v_claim.id;

  RETURN jsonb_build_object('status', 'redeemed', 'title', v_claim.title);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon_claim(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coupon_claim(text) TO authenticated;
