-- ── Security remediation (auditoría 2026-05-27) ─────────────────────────────
--
-- 1. partner_qr_codes: la policy "Authenticated users can look up qr by code"
--    usaba USING (true), permitiendo a CUALQUIER usuario autenticado hacer
--    SELECT * y enumerar los códigos de referido de todos los partners
--    (vector de fraude de atribución). El único consumidor legítimo es
--    AuthRedirect, que resuelve ref_code → partner_id justo después del
--    signup — solo necesita un lookup exacto de UN código. Se reemplaza la
--    policy abierta por una función SECURITY DEFINER que devuelve solo el
--    partner_id de un código exacto, sin posibilidad de listar la tabla.
--    (ImportCsvScreen también hace lookup por código, pero es admin-only y
--    queda cubierto por la policy "Partner reads own qr" via is_admin().)
--
-- 2. admin_notifications: la migración 20260304041011 reemplazó la policy
--    admin-only de INSERT por WITH CHECK (true). Partners y advertisers SÍ
--    insertan notificaciones "new_ad" desde el cliente (PartnerAdsScreen,
--    CreateAdScreen), así que el INSERT autenticado se mantiene pero acotado:
--    solo type='new_ad' y mensaje de máx 300 chars. Las edge functions usan
--    service role (bypass RLS) y no se ven afectadas.

-- ── 1. partner_qr_codes: lookup exacto via RPC, sin enumeración ──────────────
DROP POLICY IF EXISTS "Authenticated users can look up qr by code"
  ON public.partner_qr_codes;

CREATE OR REPLACE FUNCTION public.lookup_partner_by_ref_code(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id
  FROM public.partner_qr_codes
  WHERE code = p_code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_partner_by_ref_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_partner_by_ref_code(text) TO authenticated;

-- ── 2. admin_notifications: INSERT autenticado pero acotado ──────────────────
DROP POLICY IF EXISTS "Authenticated users insert notifications"
  ON public.admin_notifications;

CREATE POLICY "Users insert bounded new_ad notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type = 'new_ad'
  AND char_length(message) BETWEEN 1 AND 300
);
