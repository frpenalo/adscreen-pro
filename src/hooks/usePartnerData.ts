import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePartnerProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["partner-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const usePartnerSales = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["partner-sales", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_sales_attribution")
        .select("*, shopify_imports(imported_at)")
        .eq("partner_id", user!.id)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const usePartnerReferrals = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["partner-referrals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisers")
        .select("*")
        .eq("referred_partner_id", user!.id)
        .order("business_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const usePartnerEarnings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["partner-earnings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_referral_earnings_manual")
        .select("*, advertisers(business_name)")
        .eq("partner_id", user!.id)
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const usePartnerPayouts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["partner-payouts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("partner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

// FASE 2 — Comisiones de productos via GoAffPro
// Se activa cuando integremos GoAffPro API con AdScreenPro
// export const usePartnerCommissions = () => {
//   const { user } = useAuth();
//   return useQuery({
//     queryKey: ["partner-commissions", user?.id],
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from("partner_commissions")
//         .select("*")
//         .eq("partner_id", user!.id)
//         .order("created_at", { ascending: false });
//       if (error) throw error;
//       return data;
//     },
//     enabled: !!user?.id,
//   });
// };

export const useRegisterGoAffPro = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await supabase.auth.refreshSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-goaffpro-affiliate`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-profile"] });
    },
  });
};

export const usePartnerQrCode = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["partner-qr", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_qr_codes")
        .select("*")
        .eq("partner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};
