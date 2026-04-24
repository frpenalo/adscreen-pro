/**
 * render-advertiser-ad.mjs — Render a partner's animated advertiser ad video.
 *
 * Usage:
 *   node scripts/render-advertiser-ad.mjs <ad_id> <photo_url> <business_name> <tagline> <cta> [category]
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Args ──────────────────────────────────────────────────────────────────────
const [adId, photoUrl, businessName, tagline, cta, category] = process.argv.slice(2);

if (!adId || !photoUrl || !businessName) {
  console.error("Usage: node render-advertiser-ad.mjs <ad_id> <photo_url> <business_name> <tagline> <cta> [category]");
  process.exit(1);
}

// ── Category → AdStyle mapping ────────────────────────────────────────────────
function categoryToAdStyle(cat) {
  const c = (cat || "").toLowerCase().trim();
  if (c.includes("barber") || c.includes("barberia") || c.includes("barbershop")) return "dark-gold";
  if (c.includes("restaurante") || c.includes("restaurant") || c.includes("comida") || c.includes("food") || c.includes("balloon") || c.includes("entretenimiento")) return "warm-amber";
  if (c.includes("belleza") || c.includes("salon") || c.includes("nail") || c.includes("spa") || c.includes("estetica")) return "rose-elegant";
  if (c.includes("gym") || c.includes("fitness") || c.includes("automotriz") || c.includes("automotive")) return "bold-energy";
  if (c.includes("salud") || c.includes("health") || c.includes("farmacia") || c.includes("educacion") || c.includes("education") || c.includes("retail") || c.includes("tienda")) return "clean-pro";
  return "dark-gold";
}

const adStyle = categoryToAdStyle(category);

// ── Supabase REST helpers ─────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const authHeaders = {
  "Authorization": `Bearer ${serviceKey}`,
  "apikey": serviceKey,
};

async function uploadToStorage(bucket, storagePath, buffer, contentType) {
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": contentType,
      "x-upsert": "true",
      // 60s en lugar del default de 3600s — permite que los re-renders
      // lleguen rápido a las pantallas sin esperar 1 hora por el CDN.
      "cache-control": "max-age=60",
    },
    body: buffer,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${err}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}

async function dbPatch(table, filters, data) {
  const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join("&");
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB patch failed (${res.status}): ${err}`);
  }
}

const tmpDir = os.tmpdir();

async function main() {
  console.log(`\nRendering AdvertiserAd for ad: ${adId} / business: ${businessName}`);

  // ── 1. Bundle Remotion ───────────────────────────────────────────────────
  console.log("Bundling Remotion composition...");
  const entryPoint = path.join(__dirname, "../src/index.ts");
  const bundleLocation = await bundle({ entryPoint });
  console.log("Bundle ready");

  // ── 2. Select composition with props ────────────────────────────────────
  const inputProps = {
    photoUrl,
    businessName,
    tagline: tagline || "",
    cta: cta || "Visítanos",
    adStyle,
  };

  console.log(`Category: "${category || "none"}" → adStyle: "${adStyle}"`);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "AdvertiserAd",
    inputProps,
  });

  // ── 3. Render video ──────────────────────────────────────────────────────
  console.log("Rendering video (this takes ~90s)...");
  const outputPath = path.join(tmpDir, `advertiser-ad-${adId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    // HD (1920x1080) debe ir marcado como BT.709 para que TVs/navegadores
    // decodifiquen los colores correctamente (sin esto, algunos asumen BT.601
    // y los negros se vuelven azulados y los dorados rosados).
    colorSpace: "bt709",
    // yuv420p explícito — pixel format estándar que toda TV puede decodificar.
    pixelFormat: "yuv420p",
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
    },
  });
  console.log("\nVideo rendered:", outputPath);

  // ── 4. Upload MP4 to Supabase Storage ───────────────────────────────────
  console.log("Uploading video to Supabase Storage...");
  const videoStoragePath = `advertiser-ads/${adId}.mp4`;
  const videoPublicUrl = await uploadToStorage(
    "ad-media",
    videoStoragePath,
    fs.readFileSync(outputPath),
    "video/mp4"
  );
  console.log("Video URL:", videoPublicUrl);

  // ── 5. Update ad record with final_media_path ────────────────────────────
  console.log("Updating ads table...");
  await dbPatch("ads", { id: adId }, { final_media_path: videoPublicUrl });
  console.log("Ad record updated");

  // ── 6. Cleanup temp file ─────────────────────────────────────────────────
  fs.unlinkSync(outputPath);

  console.log(`\nDone! Advertiser ad rendered for ad_id: ${adId}`);
}

main().catch((err) => {
  console.error("\nRender failed:", err.message);
  process.exit(1);
});
