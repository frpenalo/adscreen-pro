import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const goaffproToken = Deno.env.get("GOAFFPRO_ACCESS_TOKEN")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get partner profile
    const { data: partner, error: partnerErr } = await adminClient
      .from("partners")
      .select("*")
      .eq("id", user.id)
      .single();

    if (partnerErr || !partner) {
      return new Response(JSON.stringify({ error: "Partner not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already registered with a real GoAffPro ID — return immediately
    const existingId = (partner as any).goaffpro_affiliate_id;
    if (existingId && existingId !== "pending") {
      return new Response(JSON.stringify({
        success: true,
        already_registered: true,
        referral_link: (partner as any).goaffpro_referral_link,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get email
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    const email = profile?.email ?? user.email ?? "";
    const name = (partner as any).business_name ?? email;

    // Register in GoAffPro
    const goaffproRes = await fetch("https://api.goaffpro.com/v1/admin/affiliates", {
      method: "POST",
      headers: {
        "x-goaffpro-access-token": goaffproToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });

    const responseJson = await goaffproRes.json();
    console.log("GoAffPro POST status:", goaffproRes.status, JSON.stringify(responseJson).slice(0, 300));

    const errorMsg = (responseJson?.error ?? responseJson?.message ?? "").toLowerCase();
    const alreadyExists = errorMsg.includes("already registered") || errorMsg.includes("already exists");

    let affiliateId: string;
    let referralLink: string;

    if (alreadyExists) {
      // Already in GoAffPro — save "pending" so we don't retry on every login
      // Real ID will be fetched by sync-goaffpro-affiliate when admin approves
      affiliateId = "pending";
      referralLink = null;
      console.log("Affiliate already existed in GoAffPro, marked as pending");
    } else if (goaffproRes.ok) {
      // Freshly created — extract real ID from response
      const data = responseJson.affiliate ?? responseJson.data ?? responseJson;
      const rawId = data.id ?? data._id ?? data.affiliate_id;
      affiliateId = rawId ? String(rawId) : "pending";

      // Fetch affiliate from GoAffPro by ID to get the real ref_code
      if (affiliateId !== "pending") {
        const getRes = await fetch(`https://api.goaffpro.com/v1/admin/affiliates?id=${affiliateId}`, {
          headers: { "x-goaffpro-access-token": goaffproToken },
        });
        const getJson = await getRes.json();
        console.log("GoAffPro GET affiliate:", JSON.stringify(getJson).slice(0, 500));
        const list = Array.isArray(getJson) ? getJson : getJson.affiliates ?? getJson.data ?? [];
        const aff = list[0] ?? {};
        const refCode = aff.ref_code ?? null;
        referralLink = refCode ? `https://regalove.co/?ref=${refCode}` : null;
      }
      console.log("New affiliate created:", affiliateId, referralLink);
    } else {
      throw new Error(`GoAffPro error ${goaffproRes.status}: ${JSON.stringify(responseJson)}`);
    }

    // Save to partner record
    await adminClient
      .from("partners")
      .update({
        goaffpro_affiliate_id: affiliateId,
        goaffpro_referral_link: referralLink,
      })
      .eq("id", user.id);

    return new Response(JSON.stringify({
      success: true,
      affiliate_id: affiliateId,
      referral_link: referralLink,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("register-goaffpro-affiliate error:", err);
    return new Response(JSON.stringify({ error: err.message || "Error registering affiliate" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
