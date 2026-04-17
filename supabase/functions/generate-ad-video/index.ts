/**
 * generate-ad-video — Triggers GitHub Actions to render an animated advertiser ad.
 *
 * POST body: { ad_id, photo_url, business_name, tagline, cta, advertiser_id }
 *
 * Deploy with: npx supabase functions deploy generate-ad-video --no-verify-jwt
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-ad-video called");

    const ghPat = Deno.env.get("GH_PAT");

    if (!ghPat) {
      return new Response(JSON.stringify({ error: "GH_PAT not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { ad_id, photo_url, business_name, tagline, cta, advertiser_id } = body;

    console.log("ad_id:", ad_id, "business_name:", business_name, "advertiser_id:", advertiser_id);

    if (!ad_id || !photo_url || !business_name || !advertiser_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: ad_id, photo_url, business_name, advertiser_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Dispatch GitHub Actions workflow ──────────────────────────────────────
    console.log("Dispatching GitHub Actions workflow for AdvertiserAd render...");
    const ghRes = await fetch(
      "https://api.github.com/repos/frpenalo/adscreen-pro/actions/workflows/render-advertiser-ad.yml/dispatches",
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
            ad_id,
            photo_url,
            business_name,
            tagline: tagline ?? "",
            cta: cta ?? "Visítanos",
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

    console.log("Render triggered for ad_id:", ad_id);

    return new Response(
      JSON.stringify({ success: true }),
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
