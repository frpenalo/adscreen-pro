/**
 * send-monthly-reports — Reporte mensual de ROI para cada advertiser.
 *
 * Antichurn #1: demostrar valor cada mes sin que lo pidan. Agrega del mes
 * anterior, por advertiser:
 *   - Impresiones totales (ad_logs) + desglose por pantalla
 *   - Cupones reclamados y canjeados (coupon_claims)
 * Guarda el reporte en advertiser_reports (idempotente por periodo) y, si
 * RESEND_API_KEY está configurado, lo envía por email.
 *
 * Auth: header x-report-key === REPORT_CRON_SECRET. Lo invoca pg_cron el
 * día 1 de cada mes. Idempotente: re-invocar no duplica ni re-envía.
 *
 * Body opcional (para pruebas):
 *   { periodStart: "YYYY-MM-01", dryRun: true, onlyAdvertiserId: "uuid" }
 *   - dryRun: calcula y devuelve, NO guarda ni envía
 *   - sin body: usa el mes anterior al actual
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-report-key",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Primer día del mes anterior al de la fecha dada (UTC).
function previousMonthStart(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11, mes actual
  const prev = new Date(Date.UTC(y, m - 1, 1));
  return prev.toISOString().slice(0, 10);
}

// Primer día del mes siguiente a un "YYYY-MM-01".
function nextMonthStart(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    .toISOString().slice(0, 10);
}

function monthLabel(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  return d.toLocaleDateString("es-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

interface AdvertiserReport {
  advertiserId: string;
  businessName: string;
  email: string;
  impressions: number;
  byScreen: { screenId: string; impressions: number }[];
  couponsClaimed: number;
  couponsRedeemed: number;
}

function buildEmailHtml(r: AdvertiserReport, period: string): string {
  const screensRows = r.byScreen
    .map(
      (s) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">Pantalla ${s.screenId.slice(0, 8)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${s.impressions.toLocaleString("es-US")}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#0f0a1e;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">AdScreenPro</span>
    </div>
    <div style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
      <div style="background:linear-gradient(135deg,#f59e0b,#ea580c);padding:28px 24px;text-align:center;">
        <p style="margin:0;color:#7c2d12;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Tu reporte de ${period}</p>
        <p style="margin:6px 0 0;color:#431407;font-size:24px;font-weight:800;">${r.businessName}</p>
      </div>
      <div style="padding:28px 24px;">
        <div style="display:flex;gap:12px;text-align:center;margin-bottom:24px;">
          <div style="flex:1;background:#fef3c7;border-radius:14px;padding:18px 8px;">
            <p style="margin:0;font-size:32px;font-weight:800;color:#b45309;">${r.impressions.toLocaleString("es-US")}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Veces en pantalla</p>
          </div>
          <div style="flex:1;background:#dcfce7;border-radius:14px;padding:18px 8px;">
            <p style="margin:0;font-size:32px;font-weight:800;color:#15803d;">${r.couponsRedeemed}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:1px;">Cupones canjeados</p>
          </div>
        </div>
        ${
          r.couponsClaimed > 0
            ? `<p style="margin:0 0 20px;text-align:center;color:#475569;font-size:14px;">${r.couponsClaimed} clientes reclamaron tu cupón · ${r.couponsRedeemed} lo usaron en tu negocio</p>`
            : ""
        }
        ${
          screensRows
            ? `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;"><thead><tr><th style="padding:6px 12px;text-align:left;color:#94a3b8;font-size:12px;text-transform:uppercase;">Pantalla</th><th style="padding:6px 12px;text-align:right;color:#94a3b8;font-size:12px;text-transform:uppercase;">Vistas</th></tr></thead><tbody>${screensRows}</tbody></table>`
            : ""
        }
        <div style="margin-top:28px;text-align:center;">
          <a href="https://adscreenpro.com/dashboard/advertiser" style="display:inline-block;background:#1e1b4b;color:#fff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:12px;font-size:15px;">Ver mi panel</a>
        </div>
      </div>
    </div>
    <p style="text-align:center;color:#64748b;font-size:12px;margin-top:20px;">Tu anuncio sigue trabajando para ti en pantallas de Raleigh.</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("REPORT_CRON_SECRET");
    if (!cronSecret) return json({ error: "Reports not configured" }, 503);
    if (req.headers.get("x-report-key") !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* sin body */ }

    const periodStart = body.periodStart ?? previousMonthStart(new Date());
    const periodEnd = nextMonthStart(periodStart);
    const dryRun = body.dryRun === true;
    const onlyAdvertiserId = body.onlyAdvertiserId ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── Advertisers (con email desde profiles) ─────────────────────────────
    let advQuery = supabase
      .from("advertisers")
      .select("id, business_name, profiles(email)");
    if (onlyAdvertiserId) advQuery = advQuery.eq("id", onlyAdvertiserId);
    const { data: advertisers, error: advErr } = await advQuery;
    if (advErr) throw new Error(advErr.message);

    // ── Ads → mapa ad_id → advertiser_id ───────────────────────────────────
    const { data: ads } = await supabase.from("ads").select("id, advertiser_id");
    const adToAdv = new Map<string, string>();
    for (const a of ads ?? []) {
      if ((a as any).advertiser_id) adToAdv.set(a.id, (a as any).advertiser_id);
    }

    // ── Impresiones del periodo ────────────────────────────────────────────
    const { data: logs } = await supabase
      .from("ad_logs")
      .select("ad_id, location_id")
      .gte("created_at", `${periodStart}T00:00:00Z`)
      .lt("created_at", `${periodEnd}T00:00:00Z`);

    // advertiser_id → { total, byScreen Map }
    const impByAdv = new Map<string, { total: number; screens: Map<string, number> }>();
    for (const l of logs ?? []) {
      const advId = adToAdv.get((l as any).ad_id);
      if (!advId) continue;
      const entry = impByAdv.get(advId) ?? { total: 0, screens: new Map() };
      entry.total++;
      const sid = (l as any).location_id ?? "unknown";
      entry.screens.set(sid, (entry.screens.get(sid) ?? 0) + 1);
      impByAdv.set(advId, entry);
    }

    // ── Cupones → mapa coupon_id → advertiser_id ───────────────────────────
    const { data: coupons } = await supabase.from("coupons").select("id, advertiser_id");
    const couponToAdv = new Map<string, string>();
    for (const c of coupons ?? []) couponToAdv.set(c.id, (c as any).advertiser_id);

    const { data: claims } = await supabase
      .from("coupon_claims")
      .select("coupon_id, redeemed_at")
      .gte("claimed_at", `${periodStart}T00:00:00Z`)
      .lt("claimed_at", `${periodEnd}T00:00:00Z`);

    const couponByAdv = new Map<string, { claimed: number; redeemed: number }>();
    for (const cl of claims ?? []) {
      const advId = couponToAdv.get((cl as any).coupon_id);
      if (!advId) continue;
      const e = couponByAdv.get(advId) ?? { claimed: 0, redeemed: 0 };
      e.claimed++;
      if ((cl as any).redeemed_at) e.redeemed++;
      couponByAdv.set(advId, e);
    }

    // ── Construir reportes (solo advertisers con actividad) ────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const reports: AdvertiserReport[] = [];
    let saved = 0;
    let emailed = 0;

    for (const adv of advertisers ?? []) {
      const imp = impByAdv.get(adv.id);
      const cou = couponByAdv.get(adv.id);
      const impressions = imp?.total ?? 0;
      const couponsClaimed = cou?.claimed ?? 0;

      // Sin actividad → no enviar reporte vacío (peor que no enviar nada).
      if (impressions === 0 && couponsClaimed === 0) continue;

      const byScreen = imp
        ? [...imp.screens.entries()]
            .map(([screenId, n]) => ({ screenId, impressions: n }))
            .sort((a, b) => b.impressions - a.impressions)
        : [];

      const report: AdvertiserReport = {
        advertiserId: adv.id,
        businessName: (adv as any).business_name ?? "tu negocio",
        email: (adv as any).profiles?.email ?? "",
        impressions,
        byScreen,
        couponsClaimed,
        couponsRedeemed: cou?.redeemed ?? 0,
      };
      reports.push(report);

      if (dryRun) continue;

      // ── Persistir (idempotente por advertiser+periodo) ───────────────────
      const { error: upErr } = await supabase
        .from("advertiser_reports")
        .upsert(
          {
            advertiser_id: adv.id,
            period_start: periodStart,
            period_end: periodEnd,
            payload: report as unknown as Record<string, unknown>,
          },
          { onConflict: "advertiser_id,period_start", ignoreDuplicates: false },
        );
      if (upErr) {
        console.error(`upsert failed for ${adv.id}: ${upErr.message}`);
        continue;
      }
      saved++;

      // ── Email (solo si Resend está configurado y hay destinatario) ───────
      if (resendKey && report.email) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AdScreenPro <reportes@adscreenpro.com>",
            to: report.email,
            subject: `📊 ${report.businessName}: tu reporte de ${monthLabel(periodStart)}`,
            html: buildEmailHtml(report, monthLabel(periodStart)),
          }),
        });
        if (emailRes.ok) {
          emailed++;
          await supabase
            .from("advertiser_reports")
            .update({ emailed: true })
            .eq("advertiser_id", adv.id)
            .eq("period_start", periodStart);
        } else {
          console.error(`email failed for ${adv.id}: ${await emailRes.text()}`);
        }
      }
    }

    return json({
      period: periodStart,
      dryRun,
      advertisersWithActivity: reports.length,
      saved,
      emailed,
      emailConfigured: !!resendKey,
      reports: dryRun ? reports : undefined,
    });
  } catch (err) {
    console.error("send-monthly-reports error:", (err as Error).message);
    return json({ error: "Internal error" }, 500);
  }
});
