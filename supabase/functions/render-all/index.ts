/**
 * render-all — Despliegue masivo de los videos v2 (Gemini Omni) a TODOS los
 * partners. Admin-only.
 *
 * Por cada partner dispara los workflows de GitHub Actions:
 *   - render-teaser-v2.yml   (screen_id, selfie_url)
 *   - render-sales-ad-v3.yml (screen_id, business_name, advertiser_signup_url)
 *
 * El ref code del QR de SalesAd se lee REAL de partner_qr_codes.code (no se
 * deriva), así la atribución de comisión es correcta. Si un partner no tiene
 * code, se usa el fallback REF-{primeros8 del id} (mismo formato que genera
 * PartnersScreen).
 *
 * POST body (opcional):
 *   { teaser?: boolean, salesAd?: boolean, dryRun?: boolean }
 *   - teaser/salesAd: cuáles disparar (default ambos true)
 *   - dryRun: calcula y devuelve el plan SIN disparar nada
 *
 * Respuesta: { total, triggered, failed: [...], dryRun, plan? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GH_REPO = "frpenalo/adscreen-pro";
const ORIGIN = "https://adscreenpro.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function dispatchWorkflow(
  ghPat: string,
  workflow: string,
  inputs: Record<string, string>,
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghPat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs }),
    },
  );
  if (res.ok) return { ok: true, status: res.status };
  return { ok: false, status: res.status, detail: (await res.text()).slice(0, 200) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ghPat = Deno.env.get("GH_PAT");

    if (!ghPat) return json({ error: "GH_PAT not configured" }, 500);

    // ── Auth: JWT válido + rol admin ───────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Invalid token" }, 401);
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (profile?.role !== "admin") return json({ error: "Admin access required" }, 403);

    // ── Opciones ───────────────────────────────────────────────────────────
    let body: any = {};
    try { body = await req.json(); } catch { /* sin body */ }
    const doTeaser = body.teaser !== false;
    const doSalesAd = body.salesAd !== false;
    const dryRun = body.dryRun === true;
    // partner_id opcional: si viene, dispara SOLO ese partner (botón refresh
    // por partner); si no, dispara todos (botón "renderizar todos").
    const onlyPartnerId = body.partner_id ?? null;

    // ── Partners + sus ref codes ───────────────────────────────────────────
    let partnersQuery = supabase.from("partners").select("id, business_name");
    if (onlyPartnerId) partnersQuery = partnersQuery.eq("id", onlyPartnerId);
    const { data: partners, error: partnersErr } = await partnersQuery;
    if (partnersErr) throw new Error(partnersErr.message);

    const { data: codes } = await supabase
      .from("partner_qr_codes")
      .select("partner_id, code");
    const codeByPartner = new Map<string, string>();
    for (const c of codes ?? []) codeByPartner.set((c as any).partner_id, (c as any).code);

    // ── Construir plan + disparar ──────────────────────────────────────────
    const plan: any[] = [];
    const failed: any[] = [];
    let triggered = 0;

    for (const p of partners ?? []) {
      const screenId = p.id;
      const businessName = (p as any).business_name ?? "tu negocio";
      const refCode = codeByPartner.get(screenId) ?? `REF-${screenId.slice(0, 8).toUpperCase()}`;
      const selfieUrl = `${ORIGIN}/selfie/${screenId}`;
      const advertiserSignupUrl = `${ORIGIN}/register?role=advertiser&ref=${refCode}`;

      const item: any = { screenId, businessName, refCode };
      plan.push(item);
      if (dryRun) continue;

      if (doTeaser) {
        const r = await dispatchWorkflow(ghPat, "render-teaser-v2.yml", {
          screen_id: screenId,
          selfie_url: selfieUrl,
        });
        if (r.ok) triggered++;
        else failed.push({ screenId, workflow: "teaser-v2", status: r.status, detail: r.detail });
      }
      if (doSalesAd) {
        const r = await dispatchWorkflow(ghPat, "render-sales-ad-v3.yml", {
          screen_id: screenId,
          business_name: businessName,
          advertiser_signup_url: advertiserSignupUrl,
        });
        if (r.ok) triggered++;
        else failed.push({ screenId, workflow: "sales-ad-v3", status: r.status, detail: r.detail });
      }
    }

    return json({
      total: plan.length,
      teaser: doTeaser,
      salesAd: doSalesAd,
      triggered,
      failed,
      dryRun,
      plan: dryRun ? plan : undefined,
    });
  } catch (err) {
    console.error("render-all error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
