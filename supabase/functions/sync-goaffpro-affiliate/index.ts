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

    const { partner_id } = await req.json();
    if (!partner_id) {
      return new Response(JSON.stringify({ error: "partner_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get partner email
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", partner_id)
      .single();

    const { data: partner } = await adminClient
      .from("partners")
      .select("contact_email")
      .eq("id", partner_id)
      .single();

    const email = profile?.email ?? (partner as any)?.contact_email;
    if (!email) {
      return new Response(JSON.stringify({ error: "Partner email not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Syncing GoAffPro for email:", email);

    // Search affiliate in GoAffPro by email — request all fields explicitly
    const fields = "id,_id,email,ref_code,referral_link,ref_link,affiliate_link,status,name";
    const searchRes = await fetch(
      `https://api.goaffpro.com/v1/admin/affiliates?q=${encodeURIComponent(email)}&fields=${fields}`,
      { headers: { "x-goaffpro-access-token": goaffproToken } }
    );
    const searchJson = await searchRes.json();
    console.log("GoAffPro search:", searchRes.status, JSON.stringify(searchJson).slice(0, 1000));

    const toList = (j: any) =>
      Array.isArray(j) ? j : j.affiliates ?? j.data ?? j.results ?? [];

    let list = toList(searchJson);
    let found = list.find((a: any) =>
      (a.email ?? "").toLowerCase() === email.toLowerCase()
    ) ?? list[0] ?? null;

    // Fallback: list all with fields and filter
    if (!found || Object.keys(found).length === 0) {
      const allRes = await fetch(
        `https://api.goaffpro.com/v1/admin/affiliates?limit=200&fields=${fields}`,
        { headers: { "x-goaffpro-access-token": goaffproToken } }
      );
      const allJson = await allRes.json();
      console.log("GoAffPro all affiliates:", allRes.status, JSON.stringify(allJson).slice(0, 1000));
      list = toList(allJson);
      found = list.find((a: any) =>
        (a.email ?? "").toLowerCase() === email.toLowerCase()
      ) ?? null;
    }

    console.log("Found affiliate:", JSON.stringify(found ?? null).slice(0, 400));

    if (!found) {
      return new Response(JSON.stringify({ error: `Affiliate not found in GoAffPro for: ${email}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawId = found.id ?? found._id ?? found.affiliate_id ?? found.affiliateId;
    const affiliateId = String(rawId ?? `sync:${email}`);

    // Fetch affiliate from GoAffPro by ID to get the real ref_code
    let referralLink: string | null = null;
    if (rawId) {
      const getRes = await fetch(`https://api.goaffpro.com/v1/admin/affiliates?id=${rawId}`, {
        headers: { "x-goaffpro-access-token": goaffproToken },
      });
      const getJson = await getRes.json();
      console.log("GoAffPro GET affiliate:", JSON.stringify(getJson).slice(0, 500));
      const list = Array.isArray(getJson) ? getJson : getJson.affiliates ?? getJson.data ?? [];
      const aff = list[0] ?? {};
      const refCode = aff.ref_code ?? found.ref_code ?? null;
      referralLink = refCode ? `https://regalove.co/?ref=${refCode}` : null;
    }

    // Save to partner record
    await adminClient
      .from("partners")
      .update({
        goaffpro_affiliate_id: affiliateId,
        goaffpro_referral_link: referralLink,
      })
      .eq("id", partner_id);

    console.log("Saved:", affiliateId, referralLink);

    return new Response(JSON.stringify({
      success: true,
      affiliate_id: affiliateId,
      referral_link: referralLink,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("sync-goaffpro-affiliate error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
