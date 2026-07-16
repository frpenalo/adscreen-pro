-- ── Leads de la landing local (/raleigh-local-ads) ──────────────────────────
--
-- Formulario mínimo de captación de anunciantes locales. Es un formulario
-- PÚBLICO (visitante anónimo), así que:
--   • INSERT permitido a anon/authenticated (cualquiera puede enviar el form)
--   • SELECT solo admin (nadie más puede leer los leads de otros)
-- El honeypot y el rate-limit fino se pueden añadir después si aparece spam.

CREATE TABLE IF NOT EXISTS public.advertiser_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_name text,
  phone text,
  email text,
  business_type text,
  message text,
  source text DEFAULT 'raleigh-local-ads',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advertiser_leads ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede enviar el formulario (insert), pero nadie puede leer.
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.advertiser_leads;
CREATE POLICY "Anyone can submit a lead"
  ON public.advertiser_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Solo admin lee los leads.
DROP POLICY IF EXISTS "Admin reads leads" ON public.advertiser_leads;
CREATE POLICY "Admin reads leads"
  ON public.advertiser_leads FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS advertiser_leads_created_idx
  ON public.advertiser_leads (created_at DESC);
