/**
 * claim-coupon — El cliente escanea el QR del ad y reclama un cupón.
 *
 * Body: { couponId: string (uuid), fp: string (device fingerprint hash) }
 *
 * Validaciones:
 *   - Cupón existe, está activo y no expiró
 *   - No se superó max_claims (si está definido)
 *   - Anti-abuso: 1 claim por dispositivo por cupón (unique index — si ya
 *     reclamó, devolvemos el MISMO código: claim idempotente, re-escanear
 *     muestra el cupón de nuevo en vez de un error), y máx 10 claims por
 *     IP por día entre todos los cupones (mismo patrón que transform-selfie).
 *
 * Devuelve: { code, alreadyClaimed, coupon: { title, description, terms,
 *             expiresAt, businessName } }
 *
 * Se llama con el anon key como Bearer (igual que transform-selfie) — el
 * INSERT lo hace el service role porque coupon_claims no tiene policy de
 * INSERT para usuarios.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT_PER_IP_24H = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L) — el cliente va a leer
// el código en voz alta o el staff lo va a teclear mirando el teléfono.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { couponId, fp } = await req.json();

    if (!couponId || !UUID_RE.test(couponId)) {
      return jsonResponse({ error: "Invalid couponId" }, 400);
    }
    if (!fp || typeof fp !== "string" || fp.length < 16 || fp.length > 128) {
      return jsonResponse({ error: "Invalid fingerprint" }, 400);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── 1. Cupón válido (activo + no expirado) + datos del negocio ─────────
    const { data: coupon, error: couponErr } = await supabase
      .from("coupons")
      .select("id, title, description, terms, expires_at, max_claims, status, advertisers(business_name)")
      .eq("id", couponId)
      .maybeSingle();

    if (couponErr) throw new Error(couponErr.message);
    if (!coupon || coupon.status !== "active") {
      return jsonResponse({ error: "Coupon not available" }, 404);
    }
    if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
      return jsonResponse({ error: "Coupon expired" }, 410);
    }

    const couponPayload = {
      title: coupon.title,
      description: coupon.description,
      terms: coupon.terms,
      expiresAt: coupon.expires_at,
      businessName: (coupon as any).advertisers?.business_name ?? null,
    };

    // ── 2. Claim idempotente: si este dispositivo ya reclamó, devolver el
    //       mismo código (re-escanear el QR re-muestra el cupón) ───────────
    const { data: existing } = await supabase
      .from("coupon_claims")
      .select("code")
      .eq("coupon_id", couponId)
      .eq("device_fingerprint", fp)
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        code: existing.code,
        alreadyClaimed: true,
        coupon: couponPayload,
      });
    }

    // ── 3. Rate limit por IP (10 claims / 24h entre todos los cupones) ─────
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipCount } = await supabase
      .from("coupon_claims")
      .select("id", { count: "exact", head: true })
      .eq("client_ip", ip)
      .gte("claimed_at", dayAgo);

    if ((ipCount ?? 0) >= LIMIT_PER_IP_24H) {
      return jsonResponse({ error: "Too many claims, try again tomorrow" }, 429);
    }

    // ── 4. Cupo del cupón (max_claims) ─────────────────────────────────────
    if (coupon.max_claims != null) {
      const { count: claimCount } = await supabase
        .from("coupon_claims")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", couponId);
      if ((claimCount ?? 0) >= coupon.max_claims) {
        return jsonResponse({ error: "Coupon sold out" }, 410);
      }
    }

    // ── 5. Generar código único: PREFIJO-XXXX (prefijo = negocio) ──────────
    const prefix = (couponPayload.businessName ?? "ADS")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3)
      .padEnd(3, "X");

    let code = "";
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      code = `${prefix}-${randomCode(4)}`;
      const { error: insErr } = await supabase.from("coupon_claims").insert({
        coupon_id: couponId,
        code,
        device_fingerprint: fp,
        client_ip: ip,
      });
      if (!insErr) {
        inserted = true;
      } else if (insErr.code === "23505" && insErr.message.includes("one_per_device")) {
        // Carrera: otro request del mismo dispositivo ganó. Devolver el suyo.
        const { data: raced } = await supabase
          .from("coupon_claims")
          .select("code")
          .eq("coupon_id", couponId)
          .eq("device_fingerprint", fp)
          .maybeSingle();
        if (raced) {
          return jsonResponse({
            code: raced.code,
            alreadyClaimed: true,
            coupon: couponPayload,
          });
        }
        throw new Error(insErr.message);
      } else if (insErr.code !== "23505") {
        // 23505 en `code` = colisión del código random → reintentar
        throw new Error(insErr.message);
      }
    }

    if (!inserted) {
      throw new Error("Could not generate a unique code");
    }

    console.log(`Coupon claimed: coupon=${couponId} code=${code} ip=${ip}`);

    return jsonResponse({ code, alreadyClaimed: false, coupon: couponPayload });
  } catch (err) {
    console.error("claim-coupon error:", (err as Error).message);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
