import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAllAdvertisers = () =>
  useQuery({
    queryKey: ["admin-advertisers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisers")
        .select("*, profiles(email)")
        .order("business_name");
      if (error) throw error;
      return data;
    },
  });

export const useAllPartners = () =>
  useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*, profiles(email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const usePendingAds = () =>
  useQuery({
    queryKey: ["admin-pending-ads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("*, profiles!advertiser_id(advertisers(business_name), partners(business_name))")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useAllEarnings = () =>
  useQuery({
    queryKey: ["admin-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_referral_earnings_manual")
        .select("*, partners(business_name), advertisers(business_name)")
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useAllPayouts = () =>
  useQuery({
    queryKey: ["admin-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("*, partners(business_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useAdminSettings = () =>
  useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("id", "singleton")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const useAdminNotifications = () =>
  useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
