/**
 * generate-ad-video — Triggers GitHub Actions to render an animated advertiser ad.
 *
 * POST body: { ad_id, photo_url, business_name, tagline, cta, advertiser_id }
 *
 * Auth: Bearer token de un usuario autenticado (mismo patrón que generate-ad).
 * El ad debe pertenecerle (ads.advertiser_id = user.id) o el usuario debe ser
 * admin (re-render desde AdvertisersScreen, chequeado con el RPC is_admin
 * igual que generate-spec-ad).
 *
 * Rate limit: máx 3 dispatches por advertiser cada 24h, contados en la tabla
 * render_dispatches ANTES de disparar el workflow — mismo patrón DB-backed de
 * transform-selfie. Los re-renders del admin no consumen cupo del advertiser.
 *
 * Deploy with: npx supabase functions deploy generate-ad-video --no-verify-jwt
 * (el JWT se verifica dentro de la función con auth.getUser)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Un advertiser legítimo dispara 1 render por ad creado y el cupo mensual de
// ads ya lo limita el trigger count_advertiser_ad. 3/día cubre "crear, borrar
// y recrear" sin dejar espacio para quemar minutos de GitHub Actions.
const LIMIT_PER_ADVERTISER_24H = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    console.log("generate-ad-video called");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ghPat = Deno.env.get("GH_PAT");

    if (!ghPat) {
      return json(500, { error: "GH_PAT not configured" });
    }

    // ── Auth check (mismo patrón que generate-ad) ─────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return json(401, { error: "Unauthorized" });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return json(401, { error: "Unauthorized", detail: authErr?.message });
    }

    const body = await req.json();
    const { ad_id, photo_url, business_name, tagline, cta, advertiser_id, category } = body;

    console.log("ad_id:", ad_id, "business_name:", business_name, "category:", category, "advertiser_id:", advertiser_id, "user:", user.id);

    if (!ad_id || !photo_url || !business_name || !advertiser_id) {
      return json(400, { error: "Missing required fields: ad_id, photo_url, business_name, advertiser_id" });
    }

    // ── Ownership: el ad existe y es del usuario — o el usuario es admin ──────
    // El advertiser_id del body no se confía; el dueño real es el de la fila.
    const { data: ad, error: adErr } = await adminClient
      .from("ads")
      .select("id, advertiser_id")
      .eq("id", ad_id)
      .maybeSingle();
    if (adErr) {
      return json(500, { error: "DB error", detail: adErr.message });
    }
    if (!ad) {
      return json(404, { error: "Ad not found" });
    }

    let isAdmin = false;
    if (ad.advertiser_id !== user.id) {
      // Mismo check de admin que generate-spec-ad: el RPC is_admin corre con
      // el JWT del usuario (con service role auth.uid() sería NULL).
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: adminFlag, error: adminErr } = await userClient.rpc("is_admin");
      if (adminErr) {
        return json(500, { error: "Failed to verify admin status", detail: adminErr.message });
      }
      if (!adminFlag) {
        return json(403, { error: "Forbidden: this ad belongs to another advertiser" });
      }
      isAdmin = true;
    }

    // ── Rate limit (antes de pagar GitHub Actions) ────────────────────────────
    // Se inserta el registro ANTES del dispatch para que requests paralelos
    // cuenten entre sí (mismo razonamiento que el placeholder de
    // transform-selfie). Si el dispatch falla, se borra y devuelve el cupo.
    // El admin no consume cupo del advertiser (re-render es operativo).
    let dispatchId: string | null = null;
    if (!isAdmin) {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countErr } = await adminClient
        .from("render_dispatches")
        .select("id", { count: "exact", head: true })
        .eq("advertiser_id", ad.advertiser_id)
        .gte("created_at", since24h);
      if (countErr) {
        return json(500, { error: "DB error", detail: countErr.message });
      }
      if ((count ?? 0) >= LIMIT_PER_ADVERTISER_24H) {
        return json(429, {
          error: "Alcanzaste el límite de videos por hoy. Intenta mañana.",
          code: "render_limit",
        });
      }

      const { data: dispatchRow, error: dispatchErr } = await adminClient
        .from("render_dispatches")
        .insert({ ad_id, advertiser_id: ad.advertiser_id })
        .select("id")
        .single();
      if (dispatchErr || !dispatchRow) {
        return json(500, { error: "DB error", detail: dispatchErr?.message });
      }
      dispatchId = dispatchRow.id;
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
            category: category ?? "",
          },
        }),
      }
    );

    const ghStatus = ghRes.status;
    const ghBody = await ghRes.text();
    console.log("GitHub dispatch status:", ghStatus, "body:", ghBody);

    if (!ghRes.ok) {
      // El render nunca arrancó: devolver el cupo consumido.
      if (dispatchId) {
        await adminClient.from("render_dispatches").delete().eq("id", dispatchId);
      }
      return json(500, { error: `GitHub dispatch failed: ${ghStatus}`, detail: ghBody });
    }

    console.log("Render triggered for ad_id:", ad_id);

    return json(200, { success: true });
  } catch (err) {
    console.error("Unhandled error:", err.message);
    return json(500, { error: err.message });
  }
});
