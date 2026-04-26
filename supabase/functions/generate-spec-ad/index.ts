/**
 * generate-spec-ad — Phase 5 of the spec-driven AdvertiserAd migration.
 *
 * Receives advertiser inputs, generates a deterministic AdSpec via
 * the shared spec generator, then dispatches the
 * `render-spec-ad.yml` GitHub Actions workflow with the spec as a
 * JSON input. The render writes to advertiser-ads-spec/{ad_id}.mp4
 * (a path that does not collide with the legacy
 * advertiser-ads/{id}.mp4) so the two outputs can be A/B compared
 * before Phase 7's switchover.
 *
 * This function lives ALONGSIDE the existing `generate-ad-video`
 * function. Production traffic continues to flow through the legacy
 * function. Manual callers (the admin UI button we'll add in
 * Phase 6) will hit this one for A/B testing.
 *
 * NO photo enhancement here yet — the Gemini integration that
 * replaces ChatGPT for image enhancement is a follow-up commit
 * (Phase 5b). For now `photo_url` is passed through to the spec
 * unchanged. `photo_vibes` is an optional input — when omitted, the
 * spec generator picks a family from category alone (still
 * deterministic via the seed).
 *
 * Auth: Bearer token + admin role check (mirrors the existing
 * approve-ad / publish-product-ad pattern).
 *
 * Required env / secrets:
 *   SUPABASE_URL                       (auto)
 *   SUPABASE_SERVICE_ROLE_KEY          (auto)
 *   SUPABASE_ANON_KEY                  (auto)
 *   GH_PAT                             GitHub PAT with workflow scope
 *
 * POST body:
 *   {
 *     ad_id:          string,           // UUID — used as the upload filename
 *     advertiser_id:  string,           // UUID — seed for deterministic variations
 *     business_name:  string,           // headline text
 *     category:       string,           // BusinessCategory or any tag
 *     tagline?:       string,
 *     cta?:           string,
 *     photo_url:      string,           // public URL of the (already-uploaded) photo
 *     photo_vibes?:   string[],         // optional PhotoVibe array — improves family selection
 *     format?:        "horizontal" | "vertical"
 *   }
 *
 * Response:
 *   { success: true, spec_summary: { family, accent, fontFamily, ctaStyle },
 *     workflow: { dispatched: true, branch: "...", run_url_hint: "..." } }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSpec } from "../_shared/specs/index.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// While the workflow file lives only on the feature branch we have to
// dispatch against that branch. After Phase 7 merges to main this flips
// to "main" — single string change, nothing else needs to move.
const WORKFLOW_BRANCH = "feature/spec-driven-migration";
const WORKFLOW_FILE = "render-spec-ad.yml";
const REPO_PATH = "frpenalo/adscreen-pro";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const ghPat = Deno.env.get("GH_PAT");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: "Server configuration error (supabase env)" }, 500);
  }
  if (!ghPat) {
    return jsonResponse({ error: "GH_PAT not configured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr) {
    return jsonResponse({ error: "Failed to verify admin status", detail: adminErr.message }, 500);
  }
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden: admin access required (Phase 5 A/B testing only)" }, 403);
  }

  // ── Parse + validate body ──────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const adId = body.ad_id as string | undefined;
  const advertiserId = body.advertiser_id as string | undefined;
  const businessName = body.business_name as string | undefined;
  const category = body.category as string | undefined;
  const tagline = body.tagline as string | undefined;
  const cta = body.cta as string | undefined;
  const photoUrl = body.photo_url as string | undefined;
  const photoVibes = body.photo_vibes as string[] | undefined;
  const format = (body.format as "horizontal" | "vertical" | undefined) ?? "horizontal";

  const missing: string[] = [];
  if (!adId) missing.push("ad_id");
  if (!advertiserId) missing.push("advertiser_id");
  if (!businessName) missing.push("business_name");
  if (!category) missing.push("category");
  if (!photoUrl) missing.push("photo_url");
  if (missing.length > 0) {
    return jsonResponse({ error: "Missing required fields", missing }, 400);
  }

  // ── Generate spec ──────────────────────────────────────────────────────────
  let spec;
  try {
    // deno-lint-ignore no-explicit-any
    spec = generateSpec({
      advertiserId: advertiserId!,
      businessName: businessName!,
      category: category!,
      tagline,
      cta,
      photoUrl: photoUrl!,
      // photoVibes is typed PhotoVibe[] in the shared module; we accept
      // any string array here and trust the caller to pass valid tags.
      photoVibes: photoVibes as any,
      format,
    });
  } catch (e) {
    return jsonResponse({ error: "Spec generation failed", detail: (e as Error).message }, 500);
  }

  // ── Dispatch GitHub workflow ───────────────────────────────────────────────
  const dispatchUrl = `https://api.github.com/repos/${REPO_PATH}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const ghRes = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ghPat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: WORKFLOW_BRANCH,
      inputs: {
        ad_id: adId,
        spec_json: JSON.stringify(spec),
        // upload_path omitted — script defaults to advertiser-ads-spec/{ad_id}.mp4
      },
    }),
  });

  if (!ghRes.ok) {
    const detail = await ghRes.text();
    return jsonResponse({
      error: `GitHub workflow dispatch failed (${ghRes.status})`,
      detail,
    }, 500);
  }

  // ── Success — return a small spec summary so callers can log/display it ───
  return jsonResponse({
    success: true,
    message: `Spec generated and render workflow dispatched. Video will be ready in ~2-3 min at ad-media/advertiser-ads-spec/${adId}.mp4`,
    spec_summary: {
      family: spec.meta?.family,
      accent: spec.tokens.accentColor,
      fontFamily: spec.tokens.fontFamily,
      cta_style: spec.cta.style,
      photo_motion: spec.photo.motion,
      headline_entry: spec.headline.entry,
      seed: spec.meta?.seed,
    },
    workflow: {
      dispatched: true,
      branch: WORKFLOW_BRANCH,
      file: WORKFLOW_FILE,
      view_runs: `https://github.com/${REPO_PATH}/actions/workflows/${WORKFLOW_FILE}`,
    },
  });
});
