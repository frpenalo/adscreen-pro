/**
 * render-spec-ad.mjs — Render an AdvertiserAd from a pre-built AdSpec.
 *
 * Phase 4 of the spec-driven migration. Lives alongside the legacy
 * render-advertiser-ad.mjs (which is unchanged). Production traffic
 * still flows through the legacy script — this one is only triggered
 * manually for A/B testing until Phase 7's switchover.
 *
 * The spec is generated upstream (in an edge function or similar)
 * and passed in via the SPEC_JSON env var. This script does NOT
 * generate the spec itself, keeping it small and focused: parse,
 * render, upload.
 *
 * Inputs (all via env vars to avoid shell-escaping headaches with
 * JSON containing double quotes / backslashes):
 *
 *   AD_ID                       (required)  ad UUID for the upload path + logs
 *   SPEC_JSON                   (required)  full AdSpec object as a JSON string
 *   UPLOAD_PATH                 (optional)  override default storage path
 *   SUPABASE_URL                (required)
 *   SUPABASE_SERVICE_ROLE_KEY   (required)
 *
 * Default upload path:
 *   advertiser-ads-spec/{ad_id}.mp4
 *
 * The "-spec" suffix keeps it visually separated from the legacy
 * advertiser-ads/{id}.mp4 so both renders coexist for visual A/B
 * comparison. The script does NOT update the `ads` table — the
 * switchover that points production at the new file happens in
 * Phase 7 after we've validated quality.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Read inputs from env ──────────────────────────────────────────────────────
const adId = process.env.AD_ID;
const specJson = process.env.SPEC_JSON;
const uploadPathOverride = process.env.UPLOAD_PATH;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!adId) {
  console.error("Missing AD_ID env var");
  process.exit(1);
}
if (!specJson) {
  console.error("Missing SPEC_JSON env var");
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// ── Parse spec ────────────────────────────────────────────────────────────────
let spec;
try {
  spec = JSON.parse(specJson);
} catch (e) {
  console.error("Invalid SPEC_JSON:", e.message);
  process.exit(1);
}

// Basic sanity check — fail loud now rather than render a broken video.
if (!spec || typeof spec !== "object") {
  console.error("SPEC_JSON did not parse to an object");
  process.exit(1);
}
if (!spec.tokens || !spec.headline || !spec.cta) {
  console.error("SPEC_JSON missing required sections (tokens, headline, cta)");
  process.exit(1);
}

const format = spec.format ?? "horizontal";
const compositionId = format === "vertical" ? "SpecAdVertical" : "SpecAdHorizontal";

// ── Supabase REST helpers ─────────────────────────────────────────────────────
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

const tmpDir = os.tmpdir();

async function main() {
  console.log(`\nRendering SpecAd (${compositionId}) for ad: ${adId}`);
  console.log(`Family: ${spec.meta?.family ?? "(meta missing)"}`);
  console.log(`Format: ${format}`);

  // 1. Bundle Remotion
  console.log("Bundling Remotion composition...");
  const entryPoint = path.join(__dirname, "../src/index.ts");
  const bundleLocation = await bundle({ entryPoint });
  console.log("Bundle ready");

  // 2. Select composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps: { spec },
  });

  // 3. Render
  console.log("Rendering video (~60-90s)...");
  const outputPath = path.join(tmpDir, `spec-ad-${adId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { spec },
    // Same BT.709 color tagging as the legacy renders — keeps colors
    // correct on Fully Kiosk / TVs across the whole pipeline.
    ffmpegOverride: ({ args }) => {
      const colorTags = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
      return [...args.slice(0, -1), ...colorTags, args[args.length - 1]];
    },
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
    },
  });
  console.log("\nVideo rendered:", outputPath);

  // 4. Upload to a parallel storage path
  const uploadPath = uploadPathOverride || `advertiser-ads-spec/${adId}.mp4`;
  console.log("Uploading to:", uploadPath);
  const videoPublicUrl = await uploadToStorage(
    "ad-media",
    uploadPath,
    fs.readFileSync(outputPath),
    "video/mp4"
  );
  console.log("Video URL:", videoPublicUrl);

  // ── Intentionally NOT updating the ads table. ─────────────────────────────
  // This is a parallel A/B path. Both the legacy file
  // (advertiser-ads/{id}.mp4) and the new one (advertiser-ads-spec/{id}.mp4)
  // need to exist simultaneously for side-by-side comparison. The DB
  // pointer flip happens in Phase 7 once we've validated the new path.

  // 5. Cleanup
  fs.unlinkSync(outputPath);
  console.log(`\nDone! Spec-driven ad uploaded for ad_id: ${adId}`);
  console.log(`Compare side-by-side:`);
  console.log(`  legacy: ${supabaseUrl}/storage/v1/object/public/ad-media/advertiser-ads/${adId}.mp4`);
  console.log(`  new:    ${videoPublicUrl}`);
}

main().catch((err) => {
  console.error("\nRender failed:", err.message);
  process.exit(1);
});
