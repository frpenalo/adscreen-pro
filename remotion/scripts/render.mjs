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

// ── Supabase REST helpers (sin supabase-js para evitar validación JWT) ────────
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

async function dbDelete(table, filters) {
  const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join("&");
  await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
    method: "DELETE",
    headers: { ...authHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
  });
}

async function dbInsert(table, row) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB insert failed (${res.status}): ${err}`);
  }
}

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
  const qrPublicUrl = await uploadToStorage("ad-media", qrStoragePath, fs.readFileSync(qrLocalPath), "image/png");
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
    // HD (1920x1080) debe ir marcado como BT.709 para que TVs/navegadores
    // decodifiquen los colores correctamente (sin esto, algunos asumen BT.601
    // y los negros se vuelven azulados y los dorados rosados).
    colorSpace: "bt709",
    // PNG lossless en el intermedio — evita compresión JPEG que puede shift de color.
    imageFormat: "png",
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
    },
  });
  console.log("\n✅ Video rendered:", outputPath);

  // ── 6. Upload MP4 to Supabase Storage ───────────────────────────────────
  console.log("☁️  Uploading video to Supabase Storage...");
  const videoStoragePath = `partner-sales-ads/${partnerId}.mp4`;
  const videoPublicUrl = await uploadToStorage("ad-media", videoStoragePath, fs.readFileSync(outputPath), "video/mp4");
  console.log("✅ Video URL:", videoPublicUrl);

  // ── 7. Remove existing sales ad for this partner, insert new one ─────────
  console.log("🗄️  Updating ads table...");
  await dbDelete("ads", { screen_id: partnerId, advertiser_id: partnerId });
  await dbInsert("ads", {
    advertiser_id: partnerId,
    screen_id: partnerId,
    type: "video",
    final_media_path: videoPublicUrl,
    status: "published",
    qr_url: null,
  });

  // ── 8. Cleanup temp files ────────────────────────────────────────────────
  fs.unlinkSync(qrLocalPath);
  fs.unlinkSync(outputPath);

  console.log(`\n🚀 Done! Sales ad published for partner: ${partnerName}`);
}

main().catch((err) => {
  console.error("\n❌ Render failed:", err.message);
  process.exit(1);
});
