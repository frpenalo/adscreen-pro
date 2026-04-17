import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const goaffproToken = Deno.env.get("GOAFFPRO_ACCESS_TOKEN")!;

  // GET all affiliates — return raw response
  const res = await fetch("https://api.goaffpro.com/v1/admin/affiliates?limit=10", {
    headers: { "x-goaffpro-access-token": goaffproToken },
  });

  const json = await res.json();

  return new Response(JSON.stringify({ status: res.status, body: json }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
