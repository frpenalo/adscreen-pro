/**
 * trigger-render — Dispara el GitHub Actions workflow para renderear
 * el video de venta personalizado de un partner.
 *
 * POST body: { partner_id: string }
 */
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
    console.log("trigger-render called");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ghPat = Deno.env.get("GH_PAT");

    console.log("ghPat present:", !!ghPat);
    console.log("anonKey present:", !!anonKey);

    if (!ghPat) {
      return new Response(JSON.stringify({ error: "GH_PAT not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase ya valida la apikey automáticamente antes de llegar aquí.
    // Solo usamos service role para operaciones de DB.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Obtener datos del partner ─────────────────────────────────────────
    const body = await req.json();
    const { partner_id } = body;
    console.log("partner_id:", partner_id);

    if (!partner_id) {
      return new Response(JSON.stringify({ error: "Missing partner_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: partner, error: partnerErr } = await supabase
      .from("partners")
      .select("business_name")
      .eq("id", partner_id)
      .single();

    console.log("partner found:", partner?.business_name, "error:", partnerErr?.message ?? "none");

    if (partnerErr || !partner) {
      return new Response(JSON.stringify({ error: "Partner not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const referralUrl = `https://adscreenpro.com/register?role=advertiser&ref=${partner_id}`;

    // ── Disparar GitHub Actions workflow ─────────────────────────────────
    console.log("Dispatching GitHub Actions workflow...");
    const ghRes = await fetch(
      "https://api.github.com/repos/frpenalo/adscreen-pro/actions/workflows/render-sales-ad.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghPat}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            partner_id,
            partner_name: partner.business_name,
            referral_url: referralUrl,
          },
        }),
      }
    );

    const ghStatus = ghRes.status;
    const ghBody = await ghRes.text();
    console.log("GitHub dispatch status:", ghStatus, "body:", ghBody);

    if (!ghRes.ok) {
      return new Response(
        JSON.stringify({ error: `GitHub dispatch failed: ${ghStatus}`, detail: ghBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Render triggered for:", partner.business_name);

    return new Response(
      JSON.stringify({ success: true, message: "Render iniciado. El video estará listo en ~2 minutos." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
