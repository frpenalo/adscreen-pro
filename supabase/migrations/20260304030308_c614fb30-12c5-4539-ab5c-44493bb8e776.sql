
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'partner', 'advertiser');
CREATE TYPE public.partner_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.ad_type AS ENUM ('image', 'video');
CREATE TYPE public.ad_status AS ENUM ('draft', 'approved', 'published', 'rejected');
CREATE TYPE public.payout_status AS ENUM ('requested', 'approved', 'rejected', 'paid');
CREATE TYPE public.cancellation_status AS ENUM ('new', 'in_progress', 'completed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Partners (before advertisers due to FK)
CREATE TABLE public.partners (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  payout_zelle TEXT,
  status partner_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Advertisers
CREATE TABLE public.advertisers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  referred_partner_id UUID REFERENCES public.partners(id)
);
ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;

-- Partner QR Codes
CREATE TABLE public.partner_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_qr_codes ENABLE ROW LEVEL SECURITY;

-- Ads
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  type ad_type NOT NULL,
  status ad_status NOT NULL DEFAULT 'draft',
  final_media_path TEXT,
  normalized_media_path TEXT,
  overlay_json JSONB,
  rejected_reason TEXT,
  yodeck_asset_id TEXT,
  yodeck_playlist_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Advertiser Brand Assets
CREATE TABLE public.advertiser_brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  logo_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.advertiser_brand_assets ENABLE ROW LEVEL SECURITY;

-- Admin Settings
CREATE TABLE public.admin_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  yodeck_playlist_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Payout Requests
CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount_usd NUMERIC NOT NULL,
  status payout_status NOT NULL DEFAULT 'requested',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Shopify Imports
CREATE TABLE public.shopify_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by_admin_id UUID NOT NULL REFERENCES public.profiles(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
ALTER TABLE public.shopify_imports ENABLE ROW LEVEL SECURITY;

-- Partner Sales Attribution
CREATE TABLE public.partner_sales_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.shopify_imports(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  order_date TIMESTAMPTZ NOT NULL,
  gross_sales_usd NUMERIC NOT NULL,
  referral_code TEXT,
  raw_row JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_sales_attribution ENABLE ROW LEVEL SECURITY;

-- Partner Referral Earnings Manual
CREATE TABLE public.partner_referral_earnings_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount_usd NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_referral_earnings_manual ENABLE ROW LEVEL SECURITY;

-- Admin Notifications
CREATE TABLE public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Advertiser Notifications
CREATE TABLE public.advertiser_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.advertiser_notifications ENABLE ROW LEVEL SECURITY;

-- Cancellation Requests
CREATE TABLE public.cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  status cancellation_status NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Security definer helper functions (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_partner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'partner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_advertiser()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'advertiser'
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cancellation_requests_updated_at BEFORE UPDATE ON public.cancellation_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_partner_referral_earnings_updated_at BEFORE UPDATE ON public.partner_referral_earnings_manual FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'advertiser'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS POLICIES =====

-- PROFILES
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- ADVERTISERS
CREATE POLICY "Advertiser reads own" ON public.advertisers FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Advertiser inserts own" ON public.advertisers FOR INSERT WITH CHECK (id = auth.uid() AND public.is_advertiser());
CREATE POLICY "Advertiser updates own" ON public.advertisers FOR UPDATE USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin deletes advertiser" ON public.advertisers FOR DELETE USING (public.is_admin());

-- PARTNERS
CREATE POLICY "Partner reads own" ON public.partners FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Partner inserts own" ON public.partners FOR INSERT WITH CHECK (id = auth.uid() AND public.is_partner());
CREATE POLICY "Partner updates own" ON public.partners FOR UPDATE USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin deletes partner" ON public.partners FOR DELETE USING (public.is_admin());

-- PARTNER QR CODES
CREATE POLICY "Partner reads own qr" ON public.partner_qr_codes FOR SELECT USING (partner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin manages qr" ON public.partner_qr_codes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin updates qr" ON public.partner_qr_codes FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin deletes qr" ON public.partner_qr_codes FOR DELETE USING (public.is_admin());

-- ADS
CREATE POLICY "Advertiser reads own ads" ON public.ads FOR SELECT USING (advertiser_id = auth.uid() OR public.is_admin());
CREATE POLICY "Advertiser inserts own ads" ON public.ads FOR INSERT WITH CHECK (advertiser_id = auth.uid() AND public.is_advertiser());
CREATE POLICY "Advertiser updates own ads" ON public.ads FOR UPDATE USING (advertiser_id = auth.uid() OR public.is_admin());
CREATE POLICY "Advertiser deletes own ads" ON public.ads FOR DELETE USING (advertiser_id = auth.uid() OR public.is_admin());

-- ADVERTISER BRAND ASSETS
CREATE POLICY "Advertiser reads own assets" ON public.advertiser_brand_assets FOR SELECT USING (advertiser_id = auth.uid() OR public.is_admin());
CREATE POLICY "Advertiser inserts own assets" ON public.advertiser_brand_assets FOR INSERT WITH CHECK (advertiser_id = auth.uid() AND public.is_advertiser());
CREATE POLICY "Advertiser deletes own assets" ON public.advertiser_brand_assets FOR DELETE USING (advertiser_id = auth.uid() OR public.is_admin());

-- ADMIN SETTINGS
CREATE POLICY "Admin reads settings" ON public.admin_settings FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin inserts settings" ON public.admin_settings FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin updates settings" ON public.admin_settings FOR UPDATE USING (public.is_admin());

-- PAYOUT REQUESTS
CREATE POLICY "Partner reads own payouts" ON public.payout_requests FOR SELECT USING (partner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Partner creates payout" ON public.payout_requests FOR INSERT WITH CHECK (partner_id = auth.uid() AND public.is_partner());
CREATE POLICY "Admin updates payout" ON public.payout_requests FOR UPDATE USING (public.is_admin());

-- SHOPIFY IMPORTS
CREATE POLICY "Admin reads imports" ON public.shopify_imports FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin inserts imports" ON public.shopify_imports FOR INSERT WITH CHECK (public.is_admin());

-- PARTNER SALES ATTRIBUTION
CREATE POLICY "Partner reads own sales" ON public.partner_sales_attribution FOR SELECT USING (partner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin inserts sales" ON public.partner_sales_attribution FOR INSERT WITH CHECK (public.is_admin());

-- PARTNER REFERRAL EARNINGS MANUAL
CREATE POLICY "Partner reads own earnings" ON public.partner_referral_earnings_manual FOR SELECT USING (partner_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin manages earnings" ON public.partner_referral_earnings_manual FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin updates earnings" ON public.partner_referral_earnings_manual FOR UPDATE USING (public.is_admin());

-- ADMIN NOTIFICATIONS
CREATE POLICY "Admin reads notifications" ON public.admin_notifications FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin inserts notifications" ON public.admin_notifications FOR INSERT WITH CHECK (public.is_admin());

-- ADVERTISER NOTIFICATIONS
CREATE POLICY "Advertiser reads own notifs" ON public.advertiser_notifications FOR SELECT USING (advertiser_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin inserts notifs" ON public.advertiser_notifications FOR INSERT WITH CHECK (public.is_admin());

-- CANCELLATION REQUESTS
CREATE POLICY "Advertiser reads own cancellations" ON public.cancellation_requests FOR SELECT USING (advertiser_id = auth.uid() OR public.is_admin());
CREATE POLICY "Advertiser creates cancellation" ON public.cancellation_requests FOR INSERT WITH CHECK (advertiser_id = auth.uid() AND public.is_advertiser());
CREATE POLICY "Admin updates cancellation" ON public.cancellation_requests FOR UPDATE USING (public.is_admin());
