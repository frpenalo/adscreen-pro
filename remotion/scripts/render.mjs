/**
 * render.mjs — Render a personalized SalesAd video for a partner.
 *
 * Usage:
 *   node scripts/render.mjs <partner_id> <partner_name> <referral_url>
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Args ──────────────────────────────────────────────────────────────────────
const [partnerId, partnerName, referralUrl] = process.argv.slice(2);

if (!partnerId || !referralUrl) {
  console.error("Usage: node render.mjs <partner_id> <partner_name> <referral_url>");
  process.exit(1);
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tmpDir = os.tmpdir();

async function main() {
  console.log(`\n🎬 Rendering SalesAd for partner: ${partnerName} (${partnerId})`);

  // ── 1. Generate QR code PNG ──────────────────────────────────────────────
  console.log("📱 Generating QR code...");
  const qrLocalPath = path.join(tmpDir, `qr-${partnerId}.png`);
  await QRCode.toFile(qrLocalPath, referralUrl, {
    width: 400,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  // ── 2. Upload QR to Supabase Storage ────────────────────────────────────
  console.log("☁️  Uploading QR to Supabase Storage...");
  const qrStoragePath = `partner-qr/${partnerId}.png`;
  const { error: qrErr } = await supabase.storage
    .from("ad-media")
    .upload(qrStoragePath, fs.readFileSync(qrLocalPath), {
      contentType: "image/png",
      upsert: true,
    });
  if (qrErr) throw new Error(`QR upload failed: ${qrErr.message}`);

  const { data: qrUrlData } = supabase.storage.from("ad-media").getPublicUrl(qrStoragePath);
  const qrPublicUrl = qrUrlData.publicUrl;
  console.log("✅ QR URL:", qrPublicUrl);

  // ── 3. Bundle Remotion ───────────────────────────────────────────────────
  console.log("📦 Bundling Remotion composition...");
  const entryPoint = path.join(__dirname, "../src/index.ts");
  const bundleLocation = await bundle({ entryPoint });
  console.log("✅ Bundle ready");

  // ── 4. Select composition with props ────────────────────────────────────
  const inputProps = {
    headline: "¿Quieres que tus clientes\nte vean aquí?",
    subtitle: "Anúnciate en esta pantalla",
    cta: "Escanea y reserva tu espacio",
    qrUrl: qrPublicUrl,
    accentColor: "#7C3AED",
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SalesAdHorizontal",
    inputProps,
  });

  // ── 5. Render video ──────────────────────────────────────────────────────
  console.log("🎥 Rendering video (this takes ~60s)...");
  const outputPath = path.join(tmpDir, `sales-ad-${partnerId}.mp4`);
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
  console.log("\n✅ Video rendered:", outputPath);

  // ── 6. Upload MP4 to Supabase Storage ───────────────────────────────────
  console.log("☁️  Uploading video to Supabase Storage...");
  const videoStoragePath = `partner-sales-ads/${partnerId}.mp4`;
  const { error: videoErr } = await supabase.storage
    .from("ad-media")
    .upload(videoStoragePath, fs.readFileSync(outputPath), {
      contentType: "video/mp4",
      upsert: true,
    });
  if (videoErr) throw new Error(`Video upload failed: ${videoErr.message}`);

  const { data: videoUrlData } = supabase.storage.from("ad-media").getPublicUrl(videoStoragePath);
  const videoPublicUrl = videoUrlData.publicUrl;
  console.log("✅ Video URL:", videoPublicUrl);

  // ── 7. Remove existing sales ad for this partner, insert new one ─────────
  console.log("🗄️  Updating ads table...");
  await supabase
    .from("ads")
    .delete()
    .eq("screen_id", partnerId)
    .eq("advertiser_id", partnerId);

  const { error: insertErr } = await supabase.from("ads").insert({
    advertiser_id: partnerId,
    screen_id: partnerId,
    type: "video",
    final_media_path: videoPublicUrl,
    status: "published",
    qr_url: null, // QR is already baked into the video
  });
  if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

  // ── 8. Cleanup temp files ────────────────────────────────────────────────
  fs.unlinkSync(qrLocalPath);
  fs.unlinkSync(outputPath);

  console.log(`\n🚀 Done! Sales ad published for partner: ${partnerName}`);
}

main().catch((err) => {
  console.error("\n❌ Render failed:", err.message);
  process.exit(1);
});
