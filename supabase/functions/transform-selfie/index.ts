// transform-selfie — anonymous endpoint that turns a customer's
// selfie into a fun AI variant (peluche / action figure / anime /
// etc.) and inserts it as a filler ad on the partner's TV.
//
// Three rate-limit layers run BEFORE we pay OpenAI:
//   1. Per-fingerprint: 3 selfies / 24h (catches same-device spam)
//   2. Per-IP:          5 selfies / 24h (catches incognito bypass)
//   3. Per-screen:      8 active selfies max (oldest auto-expire)
//
// All three return 429 with a friendly message — zero AI cost for
// rejected requests. Only when all three pass do we hit gpt-image-2.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Style → prompt map. Each prompt is engineered for gpt-image-2's
// /v1/images/edits endpoint, where the customer's photo is the input
// image and the prompt directs the transformation. Keep them
// SHORT-ish: longer prompts confuse the model on edit endpoints.
// All prompts include the "no text/letters" guardrail because
// gpt-image-2 likes to scribble random letters into outputs.
const STYLE_PROMPTS: Record<string, string> = {
  peluche:
    "Transform the person in the photo into a soft cute plush toy stuffed animal version of themselves. Felt fabric texture, button eyes, soft pastel colors, cozy studio backdrop, professional product photography, dreamy soft lighting. NO text, NO letters, NO words anywhere in the image.",
  "action-figure":
    "Transform this into a high-quality collector action figure of the person, displayed inside a clear plastic blister pack on a colorful cardboard backing card. Show small accessory items next to the figure. Toy store product photo style, vibrant saturated colors, hyperrealistic plastic texture. NO text, NO letters, NO logos, NO brand names anywhere.",
  anime:
    "Transform the person into a beautiful anime / Pixar style 3D animated character. Big expressive eyes, smooth stylized features, vibrant cinematic lighting, Studio Ghibli meets Pixar quality, soft bokeh background. Keep their identifying features (hair, glasses, beard if any). NO text, NO letters in the image.",
  caricatura:
    "Transform the person into a fun exaggerated caricature drawing — slightly oversized head, exaggerated facial features, cartoon style, bold confident strokes, bright watercolor colors. Keep them recognizable but playful. White or light background. NO text, NO letters, NO captions.",
  estatua:
    "Transform the person into a classical Greek marble statue version of themselves. Pure white Carrara marble, museum lighting, neutral gray studio backdrop, photorealistic stone texture with subtle veining, dignified classical pose. NO text, NO letters, NO inscriptions.",
  poster:
    "Transform this into a vintage 1980s Hollywood movie poster featuring the person as the main character / hero. Dramatic cinematic lighting, retro color grading, film grain, theatrical pose, atmospheric background. NO text, NO movie titles, NO letters anywhere — pure visual poster art.",
  "pixel-art":
    "Transform the person into a 16-bit pixel art sprite portrait, retro arcade game aesthetic, vibrant limited color palette, crisp pixel edges, blocky stylized features but recognizable. Plain dark background with subtle scanlines. NO text, NO letters, NO HUD elements.",
  superheroe:
    "Transform the person into a powerful comic book superhero version of themselves wearing a custom heroic costume. Dynamic action pose, dramatic lighting, comic book art style with bold inks and vibrant colors, halftone shading, atmospheric city skyline background. NO text, NO speech bubbles, NO letters.",
  "trading-card":
    "Transform this into a collectible trading card portrait of the person. Premium holographic card design, decorative frame border with gold accents, the person centered as the card character, mystical glowing background effects. NO text, NO numbers, NO words on the card — pure visual art.",
  wanted:
    "Transform this into an old west wanted poster portrait of the person. Aged sepia parchment paper texture, weathered edges, classic 1880s western photo aesthetic, hat optional, dramatic frontier lighting. NO text, NO words, NO 'WANTED' lettering — just the portrait artwork on the aged paper.",
};

const ALLOWED_STYLES = Object.keys(STYLE_PROMPTS);

// Rate-limit thresholds. Tuned conservatively: 3 selfies per device
// per day is enough for legitimate "I'll try a different style"
// behavior, but blocks the screenshot-farming attack the user flagged.
const LIMIT_PER_FP_24H = 3;
const LIMIT_PER_IP_24H = 5;
const MAX_ACTIVE_PER_SCREEN = 8;
// Selfies expire 60 minutes after creation — covers a typical
// barbershop visit (30-60 min) with a small buffer. Originally 8h,
// but that left selfies on the TV long after the customer had gone
// home, which killed the "look, that's John!" moment.
const SELFIE_EXPIRES_MINUTES = 60;

// Geofence — the customer MUST be physically inside the partner's
// business. Tight on purpose: someone outside the building (parking
// lot, sidewalk, neighboring shop) shouldn't be able to inject
// content onto the TV.
//   60m  — typical store interior + minor GPS drift
//   75m  — max reported accuracy we'll trust; worse fix → reject
const MAX_DISTANCE_METERS = 60;
const MAX_ACCURACY_METERS = 75;

// Haversine distance between two lat/lng points, in meters.
// Earth radius 6371000m. Plenty accurate at the scales we care about
// (a few km), no need for proper ellipsoid math.
function haversineMeters(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const body = await req.json();
    const { imageBase64, mimeType, screenId, style, customerName, fp, lat, lng, accuracy } = body;

    // ── Validation ─────────────────────────────────────────────────────
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json(400, { error: "imageBase64 required" });
    }
    if (!screenId || typeof screenId !== "string") {
      return json(400, { error: "screenId required" });
    }
    if (!style || !ALLOWED_STYLES.includes(style)) {
      return json(400, { error: `style must be one of: ${ALLOWED_STYLES.join(", ")}` });
    }
    if (!fp || typeof fp !== "string" || fp.length < 16) {
      return json(400, { error: "fp (fingerprint) required" });
    }
    if (typeof lat !== "number" || typeof lng !== "number" || typeof accuracy !== "number") {
      return json(400, {
        error: "Necesitamos tu ubicación para verificar que estás en el negocio.",
        code: "no_geo",
      });
    }
    // Reject low-accuracy fixes early — a 200m-accuracy reading
    // from someone outside the building could pass the distance
    // check by luck. Force them to retry with high-precision GPS.
    if (accuracy > MAX_ACCURACY_METERS) {
      return json(400, {
        error: "GPS impreciso. Activa la ubicación de alta precisión y vuelve a intentar.",
        code: "low_accuracy",
      });
    }

    // Resolve the client IP — Supabase fronts the function with a
    // proxy so x-forwarded-for is the right header. Fall back to
    // x-real-ip and finally to "unknown" so the rate limit still
    // applies (just less effectively) when both headers are stripped.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Validate the screen exists & is approved ──────────────────────
    const { data: partner, error: partnerErr } = await admin
      .from("partners")
      .select("id, status, business_name, lat, lng")
      .eq("id", screenId)
      .maybeSingle();
    if (partnerErr) return json(500, { error: "DB error", detail: partnerErr.message });
    if (!partner) return json(404, { error: "Pantalla no encontrada" });
    if (partner.status !== "approved") {
      return json(403, { error: "Esta pantalla no está activa todavía" });
    }

    // ── Geofence: customer must be physically at the business ─────────
    // Without partner coords we can't enforce — block instead of
    // silently letting selfies through. The admin needs to fix the
    // partner's address (Partners admin → edit address geocodes).
    if (partner.lat == null || partner.lng == null) {
      console.error(`[transform-selfie] partner ${screenId} has no lat/lng`);
      return json(409, {
        error: "Esta pantalla aún no está configurada con su ubicación. Pídele al negocio que contacte soporte.",
        code: "no_partner_geo",
      });
    }
    const distanceM = haversineMeters(lat, lng, partner.lat, partner.lng);
    if (distanceM > MAX_DISTANCE_METERS) {
      console.log(`[transform-selfie] geofence reject: ${Math.round(distanceM)}m from ${partner.business_name} (customer ${lat},${lng} acc=${accuracy}m vs partner ${partner.lat},${partner.lng})`);
      return json(403, {
        error: `Tienes que estar dentro de ${partner.business_name} para participar.`,
        code: "too_far",
        debug: {
          distance_m: Math.round(distanceM),
          accuracy_m: Math.round(accuracy),
          customer: { lat, lng },
          partner:  { lat: partner.lat, lng: partner.lng },
          threshold_m: MAX_DISTANCE_METERS,
        },
      });
    }

    // ── Rate-limit gates (before paying OpenAI) ───────────────────────
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Layer 1 — per-fingerprint
    const { count: fpCount } = await admin
      .from("ads")
      .select("id", { count: "exact", head: true })
      .eq("kind", "selfie")
      .gte("created_at", since24h)
      .eq("metadata->>fp" as any, fp);
    if ((fpCount ?? 0) >= LIMIT_PER_FP_24H) {
      return json(429, {
        error: "Ya tomaste varias selfies hoy. Vuelve mañana.",
        code: "fp_limit",
      });
    }

    // Layer 2 — per-IP
    const { count: ipCount } = await admin
      .from("ads")
      .select("id", { count: "exact", head: true })
      .eq("kind", "selfie")
      .gte("created_at", since24h)
      .eq("metadata->>ip" as any, ip);
    if ((ipCount ?? 0) >= LIMIT_PER_IP_24H) {
      return json(429, {
        error: "Demasiadas selfies desde esta red. Espera un poco.",
        code: "ip_limit",
      });
    }

    // Layer 3 — max active selfies per screen. Instead of blocking
    // (which would feel broken to the customer), we expire the oldest
    // active selfie so this one takes its slot. This keeps the queue
    // bounded without ever rejecting the customer.
    const { data: activeSelfies } = await admin
      .from("ads")
      .select("id")
      .eq("kind", "selfie")
      .eq("screen_id", screenId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const activeCount = activeSelfies?.length ?? 0;
    if (activeCount >= MAX_ACTIVE_PER_SCREEN && activeSelfies) {
      const toExpire = activeSelfies.slice(0, activeCount - MAX_ACTIVE_PER_SCREEN + 1);
      const ids = toExpire.map((r: any) => r.id);
      await admin
        .from("ads")
        .update({ expires_at: new Date().toISOString() })
        .in("id", ids);
    }

    // ── Generate via gpt-image-2 ──────────────────────────────────────
    const prompt = STYLE_PROMPTS[style];
    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const imageBlob = new Blob([imageBytes], { type: mimeType || "image/jpeg" });

    const formData = new FormData();
    formData.append("model", "gpt-image-2");
    formData.append("image", imageBlob, "input.jpg");
    formData.append("prompt", prompt);
    formData.append("size", "1024x1024");
    formData.append("quality", "low"); // fastest tier — selfies don't need ultra-HQ
    formData.append("n", "1");

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    let apiResponse: Response;
    try {
      apiResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if ((e as Error).name === "AbortError") {
        console.error("[transform-selfie] gpt-image-2 timed out after 90s");
        return json(504, { error: "La transformación tardó demasiado. Intenta de nuevo." });
      }
      throw e;
    }
    clearTimeout(timeoutId);
    console.log(`[transform-selfie] gpt-image-2 took ${Date.now() - startedAt}ms, status=${apiResponse.status}`);

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("[transform-selfie] OpenAI error:", apiResponse.status, errText);
      return json(502, { error: "El AI rechazó la imagen. Intenta otra foto." });
    }
    const data = await apiResponse.json();
    const b64: string | null = data.data?.[0]?.b64_json ?? null;
    if (!b64) {
      return json(502, { error: "El AI no devolvió imagen. Intenta de nuevo." });
    }

    // ── Upload to storage + insert ad row ─────────────────────────────
    const path = `selfies/${screenId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
    const buffer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { error: uploadErr } = await admin.storage
      .from("ad-media")
      .upload(path, buffer, { contentType: "image/png" });
    if (uploadErr) {
      console.error("[transform-selfie] upload failed:", uploadErr);
      return json(500, { error: "Error guardando la imagen" });
    }
    const { data: pub } = admin.storage.from("ad-media").getPublicUrl(path);

    const expiresAt = new Date(Date.now() + SELFIE_EXPIRES_MINUTES * 60 * 1000).toISOString();
    const cleanName = (customerName || "").toString().trim().slice(0, 40) || null;

    const { error: insertErr } = await admin.from("ads").insert({
      kind: "selfie",
      type: "image",
      status: "published",
      screen_id: screenId,
      advertiser_id: screenId, // selfies aren't owned by an advertiser; reuse screenId so existing FKs stay happy
      final_media_path: pub.publicUrl,
      customer_name: cleanName,
      style,
      expires_at: expiresAt,
      metadata: { fp, ip, business_name: partner.business_name },
    } as any);
    if (insertErr) {
      console.error("[transform-selfie] insert failed:", insertErr);
      return json(500, { error: "Error registrando la selfie" });
    }

    return json(200, {
      success: true,
      expiresAt,
      // Don't return the image URL — surprise mode means the customer
      // doesn't preview. The TV reveal is the moment.
      message: "¡Listo! Mira la TV.",
    });
  } catch (err: any) {
    console.error("[transform-selfie] unexpected error:", err);
    return json(500, { error: err.message || "Error inesperado" });
  }
});
