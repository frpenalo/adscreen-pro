/**
 * transcode-ad — Triggers GitHub Actions to re-encode a direct-uploaded
 * advertiser video to the Android-safe profile before it airs.
 *
 * POST body: { ad_id, video_url }
 *
 * Se despliega CON verify_jwt (default): solo usuarios autenticados pueden
 * dispararla. Deploy with: npx supabase functions deploy transcode-ad
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
    console.log("transcode-ad called");

    const ghPat = Deno.env.get("GH_PAT");

    if (!ghPat) {
      return new Response(JSON.stringify({ error: "GH_PAT not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { ad_id, video_url } = body;

    console.log("ad_id:", ad_id, "video_url:", video_url);

    if (!ad_id || !video_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: ad_id, video_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Dispatch GitHub Actions workflow ──────────────────────────────────────
    console.log("Dispatching GitHub Actions workflow for video transcode...");
    const ghRes = await fetch(
      "https://api.github.com/repos/frpenalo/adscreen-pro/actions/workflows/transcode-ad.yml/dispatches",
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
          inputs: { ad_id, video_url },
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

    console.log("Transcode triggered for ad_id:", ad_id);

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
