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
import { spawn } from "child_process";
import { fileURLToPath } from "url";

// ── Color tagging helper ──────────────────────────────────────────────────────
// Post-process the rendered MP4 to embed BT.709 color tags at BOTH levels:
//   1. The H.264 bitstream VUI parameters (via -bsf:v h264_metadata)
//   2. The MP4 container metadata (-color_primaries / -color_trc / -colorspace)
// Uses -c copy so the H.264 frame data is byte-identical to the input — no
// re-encoding, no quality loss, no codec parameter changes that could trip
// kiosk browsers. Only the color interpretation flags change, fixing the
// black→teal / gold→pink shift on TVs that default to BT.601 SD.
async function tagBT709(inPath) {
  const outPath = inPath + ".bt709.mp4";
  await new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y", "-i", inPath,
      "-c", "copy",
      "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
      "-color_primaries", "bt709",
      "-color_trc",       "bt709",
      "-colorspace",      "bt709",
      "-movflags",        "+faststart",
      outPath,
    ], { stdio: ["ignore", "ignore", "inherit"] });
    ff.on("error", reject);
    ff.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg color-tag exited ${code}`)));
  });
  fs.renameSync(outPath, inPath);
}

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
    headers: { ...authHeaders, "Content-Type": contentType, "x-upsert": "true" },
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
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
    },
  });
  console.log("\nVideo rendered:", outputPath);

  // ── 3b. Embed BT.709 color tags (bitstream + container, no re-encode) ──
  console.log("Tagging video as BT.709 (no re-encode)...");
  await tagBT709(outputPath);
  console.log("Color tags embedded");

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
