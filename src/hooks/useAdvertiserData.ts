import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAdvertiserProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advertiser-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisers")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useAdvertiserAds = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advertiser-ads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .eq("advertiser_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useAdvertiserNotifications = (limit?: number) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advertiser-notifications", user?.id, limit],
    queryFn: async () => {
      let query = supabase
        .from("advertiser_notifications")
        .select("*")
        .eq("advertiser_id", user!.id)
        .order("created_at", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useAdImpressions = (adIds: string[]) => {
  return useQuery({
    queryKey: ["ad-impressions", adIds],
    queryFn: async () => {
      if (!adIds.length) return {};
      const { data, error } = await supabase
        .from("ad_logs")
        .select("ad_id")
        .in("ad_id", adIds);
      if (error) throw error;
      // Count per ad_id
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.ad_id] = (counts[row.ad_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: adIds.length > 0,
  });
};

export const useAdImpressionsDetail = (adId: string | null) => {
  return useQuery({
    queryKey: ["ad-impressions-detail", adId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_logs")
        .select("location_id, created_at")
        .eq("ad_id", adId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Group by day
      const byDay: Record<string, number> = {};
      const byLocation: Record<string, number> = {};
      for (const row of data ?? []) {
        const day = new Date(row.created_at).toLocaleDateString();
        byDay[day] = (byDay[day] ?? 0) + 1;
        byLocation[row.location_id] = (byLocation[row.location_id] ?? 0) + 1;
      }
      return { total: data?.length ?? 0, byDay, byLocation };
    },
    enabled: !!adId,
  });
};

export const useAdClicks = (adIds: string[]) => {
  return useQuery({
    queryKey: ["ad-clicks", adIds],
    queryFn: async () => {
      if (!adIds.length) return {};
      const { data, error } = await supabase
        .from("ad_clicks")
        .select("ad_id")
        .in("ad_id", adIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.ad_id] = (counts[row.ad_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: adIds.length > 0,
  });
};

export const useSubscription = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      return { subscribed: data.subscribed ?? false, subscription_end: data.subscription_end ?? null };
    },
    enabled: !!user?.id,
    staleTime: 60_000, // re-fetch max once per minute
  });
};

export const useAdvertiserBrandAssets = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advertiser-brand-assets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertiser_brand_assets")
        .select("*")
        .eq("advertiser_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};
