import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CONTRACT_VERSION = "1.0";

export const useContractAcceptance = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contract-acceptance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_acceptances" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("contract_version", CONTRACT_VERSION)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useAcceptContract = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, signature }: { role: string; signature: string }) => {
      const { error } = await supabase
        .from("contract_acceptances" as any)
        .insert({
          user_id: user!.id,
          role,
          contract_version: CONTRACT_VERSION,
          signature,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-acceptance", user?.id] });
    },
  });
};
