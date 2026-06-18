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

// Dramatic title pool by style. One is picked randomly at selfie
// creation time and stored on the row (ads.customer_title). Used by:
//   - The branded result card the customer downloads/shares
//   - The cinematic reveal animation on the TV
//   - The pre-filled social share text
// Pool mixes EN/ES intentionally — both languages read as "cool
// collectible / gaming" naturally. Order doesn't matter (random pick).
const STYLE_TITLES: Record<string, string[]> = {
  peluche:         ["TEDDY LEGEND", "PLUSH KING", "COZY ICON", "OSITO LEGENDARIO", "SOFT MODE"],
  "action-figure": ["COLLECTOR'S EDITION", "LIMITED DROP", "RARE FIGURE", "ULTRA RARE", "EDICIÓN ESPECIAL"],
  anime:           ["MAIN CHARACTER", "PROTAGONIST", "PROTAGONISTA", "ANIME HERO", "STUDIO STAR"],
  caricatura:      ["ICON STATUS", "LIVING MEME", "PERSONAJE ÚNICO", "ONE OF ONE", "TOON LORD"],
  estatua:         ["MARBLE LEGEND", "INMORTAL", "STONE KING", "ÉPICO ETERNO", "DIVINE MODE"],
  poster:          ["BOX OFFICE HIT", "MAIN FEATURE", "ESTRELLA DEL CINE", "CINEMATIC LEGEND", "HEADLINER"],
  "pixel-art":     ["8-BIT HERO", "RETRO LEGEND", "ARCADE KING", "FINAL BOSS", "PIXEL CHAMPION"],
  superheroe:      ["EL ELEGIDO", "THE CHOSEN ONE", "HERO MODE", "POWER LEVEL: MAX", "LEGENDARY"],
  "trading-card":  ["ULTRA RARE", "HOLOGRAPHIC", "1 OF 1", "MYTHIC TIER", "COLLECTOR'S PIECE"],
  wanted:          ["MOST WANTED", "OUTLAW LEGEND", "BUSCADO", "DEAD OR ALIVE", "RENEGADE"],
};

const pickTitle = (style: string): string => {
  const pool = STYLE_TITLES[style] ?? ["LEGEND"];
  return pool[Math.floor(Math.random() * pool.length)];
};

// Rate-limit thresholds. Tuned conservatively: 3 selfies per device
// per day is enough for legitimate "I'll try a different style"
// behavior, but blocks the screenshot-farming attack the user flagged.
const LIMIT_PER_FP_24H = 2;   // máx 2 selfies por cliente/día (costo de IA)
// Tope por IP — antes 5, pero penalizaba a las barberías donde los clientes
// usan la WiFi del local (todos comparten IP → toda la tienda topaba en 5).
// El geofence (solo dentro del local) + el límite por fingerprint (2/persona)
// ya frenan el abuso; este queda alto, solo como tope anti-spam masivo
// (un atacante con incógnito infinito). ~40 cubre una barbería muy activa.
const LIMIT_PER_IP_24H = 40;
const MAX_ACTIVE_PER_SCREEN = 4;  // máx 4 activos a la vez (no saturar anuncios)
// Selfies expire 60 minutes after creation — covers a typical
// barbershop visit (30-60 min) with a small buffer. Originally 8h,
// but that left selfies on the TV long after the customer had gone
// home, which killed the "look, that's John!" moment.
const SELFIE_EXPIRES_MINUTES = 60;

// Geofence — the customer MUST be physically inside the partner's
// business. Tight on purpose: someone outside the building (parking
// lot, sidewalk, neighboring shop) shouldn't be able to inject
// content onto the TV.
//   150m — store interior + GPS drift + GEOCODING error. El lat/lng del
//          partner viene del geocoding de la dirección (Nominatim), que
//          puede estar 50-200m off del punto real. Con 60m rechazábamos a
//          clientes que SÍ estaban adentro (ej. Fade Factory: 80m off). El
//          fix preciso es corregir el pin de cada partner en el admin;
//          mientras, 150m absorbe el error sin permitir tomar selfies a
//          cuadras de distancia.
//   75m  — max reported accuracy we'll trust; worse fix → reject
const MAX_DISTANCE_METERS = 150;
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
    // Rate limits count selfies in flight (status='draft') + visible
    // (status='published'). Failed selfies (status='rejected') do NOT
    // count, so a customer whose AI call failed can retry without
    // burning a quota slot.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const countableStatuses = ["draft", "published"];

    // Layer 1 — per-fingerprint
    const { count: fpCount } = await admin
      .from("ads")
      .select("id", { count: "exact", head: true })
      .eq("kind", "selfie")
      .in("status", countableStatuses)
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
      .in("status", countableStatuses)
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

    // ── Insert placeholder row (status='draft') BEFORE the AI call ────
    // The customer's request returns success immediately after this
    // insert — they don't wait for the 45-90s of gpt-image-2. The
    // player ignores status='draft' rows, so nothing appears on the
    // TV until the background task completes and flips to 'published'.
    //
    // Two reasons to insert before the AI call (rather than after):
    //   1. Rate-limit counting works for fast parallel requests
    //      because the row exists immediately
    //   2. If the AI call or upload fails, we can surface the failure
    //      by flipping status to 'rejected' instead of swallowing it
    const expiresAt = new Date(Date.now() + SELFIE_EXPIRES_MINUTES * 60 * 1000).toISOString();
    const cleanName = (customerName || "").toString().trim().slice(0, 40) || null;

    const { data: insertedRow, error: insertErr } = await admin
      .from("ads")
      .insert({
        kind: "selfie",
        type: "image",
        status: "draft",                 // hidden from player until AI completes
        screen_id: screenId,
        advertiser_id: screenId,
        final_media_path: "",            // filled in by the background task
        customer_name: cleanName,
        customer_title: pickTitle(style),  // dramatic title shown on TV reveal + branded card
        style,
        expires_at: expiresAt,
        metadata: { fp, ip, business_name: partner.business_name },
      } as any)
      .select("id")
      .single();
    if (insertErr || !insertedRow) {
      console.error("[transform-selfie] placeholder insert failed:", insertErr);
      return json(500, { error: "Error registrando la selfie" });
    }
    const adId = (insertedRow as any).id as string;

    // ── Background task: AI + upload + flip status to published ───────
    // EdgeRuntime.waitUntil keeps the function alive until this
    // promise settles, even after the HTTP response is sent. Standard
    // pattern for Supabase Edge Functions doing post-response work.
    const backgroundTask = async () => {
      try {
        const prompt = STYLE_PROMPTS[style];
        const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
        const imageBlob = new Blob([imageBytes], { type: mimeType || "image/jpeg" });

        const formData = new FormData();
        formData.append("model", "gpt-image-2");
        formData.append("image", imageBlob, "input.jpg");
        formData.append("prompt", prompt);
        formData.append("size", "1024x1024");
        formData.append("quality", "low");
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
            console.error(`[transform-selfie] gpt-image-2 timeout for ad ${adId}`);
          } else {
            console.error(`[transform-selfie] gpt-image-2 fetch error for ad ${adId}:`, e);
          }
          await admin.from("ads").update({ status: "rejected" }).eq("id", adId);
          return;
        }
        clearTimeout(timeoutId);
        console.log(`[transform-selfie] ad ${adId}: gpt-image-2 took ${Date.now() - startedAt}ms, status=${apiResponse.status}`);

        if (!apiResponse.ok) {
          const errText = await apiResponse.text();
          console.error(`[transform-selfie] ad ${adId}: OpenAI error ${apiResponse.status}: ${errText}`);
          await admin.from("ads").update({ status: "rejected" }).eq("id", adId);
          return;
        }
        const apiData = await apiResponse.json();
        const b64: string | null = apiData.data?.[0]?.b64_json ?? null;
        if (!b64) {
          console.error(`[transform-selfie] ad ${adId}: no b64 in response`);
          await admin.from("ads").update({ status: "rejected" }).eq("id", adId);
          return;
        }

        const path = `selfies/${screenId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
        const buffer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const { error: uploadErr } = await admin.storage
          .from("ad-media")
          .upload(path, buffer, { contentType: "image/png" });
        if (uploadErr) {
          console.error(`[transform-selfie] ad ${adId}: upload failed:`, uploadErr);
          await admin.from("ads").update({ status: "rejected" }).eq("id", adId);
          return;
        }
        const { data: pub } = admin.storage.from("ad-media").getPublicUrl(path);

        // Flip the placeholder to published. The player's
        // postgres_changes subscription fires here → refetch → the
        // selfie shows up on the TV within seconds of this UPDATE.
        const { error: updateErr } = await admin
          .from("ads")
          .update({ status: "published", final_media_path: pub.publicUrl })
          .eq("id", adId);
        if (updateErr) {
          console.error(`[transform-selfie] ad ${adId}: update failed:`, updateErr);
          return;
        }
        console.log(`[transform-selfie] ad ${adId}: published successfully`);
      } catch (err) {
        console.error(`[transform-selfie] ad ${adId}: unexpected background error:`, err);
        // Best-effort flip to rejected; ignore failures here.
        await admin.from("ads").update({ status: "rejected" }).eq("id", adId).catch(() => undefined);
      }
    };

    // Edge runtime keeps the function alive until backgroundTask
    // resolves, but the response below ships to the client right
    // now (typically ~1s after the customer hit submit).
    // @ts-ignore EdgeRuntime is a Supabase Deno global, not in @types
    EdgeRuntime.waitUntil(backgroundTask());

    return json(200, {
      success: true,
      adId,
      expiresAt,
      message: "¡Listo! Mira la TV.",
    });
  } catch (err: any) {
    console.error("[transform-selfie] unexpected error:", err);
    return json(500, { error: err.message || "Error inesperado" });
  }
});
