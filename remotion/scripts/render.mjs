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
    headers: { ...authHeaders, "Content-Type": contentType, "x-upsert": "true" },
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

  // ── 4. Build per-format input props ─────────────────────────────────────
  // The horizontal video plays on the partner's TV — its audience is the
  // partner's customer who is physically inside the business. The copy
  // pitches "advertise on this screen where customers will see you".
  //
  // The vertical video is for the partner to share on their own social
  // media (WhatsApp Status, Reels, Stories). Its audience is the partner's
  // personal network — mostly other small-business owners. The copy needs
  // to make sense in that context (no "this screen" wording, since the
  // viewer isn't standing in front of any screen).
  const horizontalProps = {
    headline: "¿Quieres que tus clientes\nte vean aquí?",
    subtitle: "Anúnciate en esta pantalla",
    cta: "Escanea y reserva tu espacio",
    qrUrl: qrPublicUrl,
    accentColor: "#7C3AED",
    // 220 px on the 1920x1080 TV screen — readable from across a salon
    // without crowding the headline above it.
    qrSize: 220,
  };
  const verticalProps = {
    headline: "Tu publicidad\nen pantallas digitales",
    subtitle: "Red AdScreenPro · Raleigh NC",
    // Hide the third "y en otras..." line — the location is already in
    // the subtitle and the line was confusing in the social context.
    tagline: "",
    cta: "Escanea para más info",
    qrUrl: qrPublicUrl,
    accentColor: "#7C3AED",
    // 280 px on the 1080x1920 vertical — there's more vertical room and
    // viewers scan it from a phone screen at close range, so a larger
    // QR is both fits and improves scan reliability.
    qrSize: 280,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SalesAdHorizontal",
    inputProps: horizontalProps,
  });

  // ── 5. Render video ──────────────────────────────────────────────────────
  console.log("🎥 Rendering video (this takes ~60s)...");
  const outputPath = path.join(tmpDir, `sales-ad-${partnerId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: horizontalProps,
    // Etiquetas BT.709 al contenedor MP4 — el stream H.264 queda
    // intacto (no se transforma ni re-codifica). Solo añade metadata
    // para que TVs/navegadores no asuman BT.601 por defecto y los
    // colores oscuros no se vuelvan azules ni los dorados rosados.
    ffmpegOverride: ({ args }) => {
      const colorTags = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
      return [...args.slice(0, -1), ...colorTags, args[args.length - 1]];
    },
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

  // ── 8. Render vertical version (1080x1920) for partner social-media download ─
  // This is NOT inserted into the ads table — it's only uploaded to Storage so
  // the partner can download it from their dashboard to share on Reels/Stories.
  // Wrapped in its own try/catch so a vertical-render failure can never block
  // or undo the horizontal publish that was just completed above.
  let verticalOutputPath = null;
  try {
    console.log("\n📱 Rendering vertical version for social-media download...");
    const verticalComposition = await selectComposition({
      serveUrl: bundleLocation,
      id: "SalesAdVertical",
      inputProps: verticalProps,
    });

    verticalOutputPath = path.join(tmpDir, `sales-ad-vertical-${partnerId}.mp4`);
    await renderMedia({
      composition: verticalComposition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: verticalOutputPath,
      inputProps: verticalProps,
      ffmpegOverride: ({ args }) => {
        const colorTags = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
        return [...args.slice(0, -1), ...colorTags, args[args.length - 1]];
      },
      onProgress: ({ progress }) => {
        process.stdout.write(`\r   Vertical progress: ${Math.round(progress * 100)}%`);
      },
    });
    console.log("\n✅ Vertical rendered:", verticalOutputPath);

    const verticalStoragePath = `partner-sales-ads-vertical/${partnerId}.mp4`;
    const verticalPublicUrl = await uploadToStorage(
      "ad-media",
      verticalStoragePath,
      fs.readFileSync(verticalOutputPath),
      "video/mp4"
    );
    console.log("✅ Vertical URL:", verticalPublicUrl);
    // Note: intentionally NOT inserting into the ads table. This file is
    // only for the partner's own download; it must not appear in any
    // player rotation.
  } catch (verticalErr) {
    console.error("\n⚠️  Vertical render/upload failed (non-blocking):", verticalErr.message);
  }

  // ── 9. Cleanup temp files ────────────────────────────────────────────────
  fs.unlinkSync(qrLocalPath);
  fs.unlinkSync(outputPath);
  if (verticalOutputPath && fs.existsSync(verticalOutputPath)) {
    fs.unlinkSync(verticalOutputPath);
  }

  console.log(`\n🚀 Done! Sales ad published for partner: ${partnerName}`);
}

main().catch((err) => {
  console.error("\n❌ Render failed:", err.message);
  process.exit(1);
});
