/**
 * render-advertiser-ad.mjs — Render a partner's animated advertiser ad video.
 *
 * Usage:
 *   node scripts/render-advertiser-ad.mjs <ad_id> <photo_url> <business_name> <tagline> <cta>
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
const [adId, photoUrl, businessName, tagline, cta] = process.argv.slice(2);

if (!adId || !photoUrl || !businessName) {
  console.error("Usage: node render-advertiser-ad.mjs <ad_id> <photo_url> <business_name> <tagline> <cta>");
  process.exit(1);
}

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
  };

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
