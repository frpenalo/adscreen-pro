import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const AuthRedirect = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (!role) return;

    const meta = user.user_metadata;
    const createRecord = async () => {
      if (role === "advertiser" && meta?.customer_name) {
        // Look up partner by ref_code if present
        let referredPartnerId: string | null = null;
        if (meta?.ref_code) {
          const { data: qr } = await supabase
            .from("partner_qr_codes")
            .select("partner_id")
            .eq("code", meta.ref_code)
            .maybeSingle();
          if (qr) referredPartnerId = qr.partner_id;
        }

        await supabase.from("advertisers").upsert({
          id: user.id,
          customer_name: meta.customer_name,
          business_name: meta.business_name || "",
          category: meta.category || "",
          phone: meta.phone || "",
          ...(referredPartnerId ? { referred_partner_id: referredPartnerId } : {}),
        }, { onConflict: "id" });
      } else if (role === "partner" && meta?.business_name) {
        // Geocode address to get lat/lng
        let lat: number | null = null;
        let lng: number | null = null;
        if (meta.address) {
          try {
            const clean = meta.address
              .replace(/,?\s*(United States|Estados Unidos.*?)$/i, "")
              .replace(/(\d{5})-\d{4}/, "$1")
              .trim();
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1&countrycodes=us`);
            const geo = await res.json();
            if (geo.length > 0) { lat = parseFloat(geo[0].lat); lng = parseFloat(geo[0].lon); }
          } catch { /* non-blocking */ }
        }

        await supabase.from("partners").upsert({
          id: user.id,
          business_name: meta.business_name,
          address: meta.address || "",
          contact_name: meta.contact_name || "",
          contact_email: meta.contact_email || "",
          contact_phone: meta.contact_phone || "",
          tv_owner: meta.tv_owner === "adscreenpro" ? "adscreenpro" : "partner",
          ...(lat !== null ? { lat, lng } : {}),
        }, { onConflict: "id" });

        // Register partner in GoAffPro immediately after creation
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-goaffpro-affiliate`;
            await fetch(fnUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                "Content-Type": "application/json",
              },
            });
          }
        } catch {
          // Non-blocking — partner was already created in Supabase
        }
      }
    };

    createRecord().finally(() => {
      const dest = role === "admin" ? "/dashboard/admin"
        : role === "partner" ? "/dashboard/partner"
        : "/dashboard/advertiser";
      navigate(dest, { replace: true });
    });
  }, [user, role, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
};

export default AuthRedirect;
