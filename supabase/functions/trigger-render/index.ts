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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ghPat = Deno.env.get("GH_PAT"); // GitHub Personal Access Token

    if (!ghPat) {
      return new Response(JSON.stringify({ error: "GH_PAT not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Auth: verificar token admin ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", claimsData.claims.sub)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Obtener datos del partner ─────────────────────────────────────────
    const { partner_id } = await req.json();
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

    if (partnerErr || !partner) {
      return new Response(JSON.stringify({ error: "Partner not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const referralUrl = `https://adscreenpro.com/register?role=advertiser&ref=${partner_id}`;

    // ── Disparar GitHub Actions workflow ─────────────────────────────────
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

    if (!ghRes.ok) {
      const ghError = await ghRes.text();
      console.error("GitHub API error:", ghRes.status, ghError);
      return new Response(
        JSON.stringify({ error: `GitHub dispatch failed: ${ghRes.status}`, detail: ghError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Guardar job en DB para tracking ──────────────────────────────────
    await supabase.from("render_jobs" as any).insert({
      partner_id,
      status: "queued",
      triggered_at: new Date().toISOString(),
    }).then(() => {}); // silenciar si la tabla no existe aún

    console.log(`✅ Render triggered for partner: ${partner.business_name} (${partner_id})`);

    return new Response(
      JSON.stringify({ success: true, message: "Render iniciado. El video estará listo en ~2 minutos." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
