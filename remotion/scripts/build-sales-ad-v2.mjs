/**
 * build-sales-ad-v2.mjs
 *
 * Genera el SalesAd v2 PER-PARTNER. Combina:
 *   - Kling clip (en remotion/public/sales-ad-clip.mp4) — escena cinemática
 *     de barbería con dolly-in que termina con la pantalla TV llenando el
 *     frame (canvas warm glow).
 *   - Remotion overlay con texto + QR per-partner (composition SalesAdV2).
 *
 * Reemplaza al SalesAd original (render.mjs, text-heavy Remotion solo) que
 * tenía problemas de autoplay en Fully Kiosk. Esta versión cinemática
 * funciona porque usa el mismo pipeline de encoding que el Awakening
 * teaser (probado en Fully Kiosk / Onn stick).
 *
 * Pipeline:
 *   1. Genera QR PNG local apuntando a la URL de signup del partner
 *   2. Convierte QR a base64 data URL (sin upload — embebido)
 *   3. Bundle Remotion
 *   4. Renderea composition SalesAdV2 con inputProps {klingClipPath, qrUrl,
 *      businessName} — la composition incluye el Kling clip como Video
 *      background + text overlays
 *   5. Re-encode Android-safe con AAC silente (igual que Awakening)
 *   6. Sube a partner-sales-ads-v2/{screenId}.mp4
 *
 * Usage:
 *   node scripts/build-sales-ad-v2.mjs \
 *     <screenId> <businessName> <advertiserSignupUrl>
 *
 * Env vars (mismos que render.mjs y build-awakening-teaser.mjs):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Output: ad-media/partner-sales-ads-v2/{screenId}.mp4
 *   - 1920x1080 @ 30fps, ~10s
 *   - H.264 Constrained Baseline + yuv420p + sin B-frames + AAC silente
 *     + BT.709 + faststart
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "out");
const TMP = os.tmpdir();

// El Kling clip debe estar acá. El user lo sube manualmente una vez.
const KLING_CLIP_FILENAME = "Salesad.mp4";
const KLING_CLIP_PATH = path.join(PUBLIC, KLING_CLIP_FILENAME);

// ── Args ─────────────────────────────────────────────────────────────────────
const [screenId, businessName, advertiserSignupUrl] = process.argv.slice(2);
if (!screenId || !businessName || !advertiserSignupUrl) {
  console.error(
    "Usage: node build-sales-ad-v2.mjs <screenId> <businessName> <advertiserSignupUrl>"
  );
  console.error("");
  console.error("Ejemplo:");
  console.error(
    '  node build-sales-ad-v2.mjs abc123 "Softmedia Barbería" https://adscreenpro.com/register?role=advertiser&ref=ABC123'
  );
  process.exit(1);
}

// ── Supabase REST helpers ────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en env vars");
  process.exit(1);
}
const authHeaders = {
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
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
  const params = Object.entries(filters)
    .map(([k, v]) => `${k}=eq.${v}`)
    .join("&");
  await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
    method: "DELETE",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  });
}

async function dbInsert(table, row) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB insert failed (${res.status}): ${err}`);
  }
}

// ── ffmpeg helpers ──────────────────────────────────────────────────────────
function runFfmpeg(args, label = "ffmpeg") {
  console.log(`\n→ ${label}`);
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegInstaller.path, args, { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

// ── Sanity checks ────────────────────────────────────────────────────────────
if (!fs.existsSync(KLING_CLIP_PATH)) {
  console.error(`❌ Falta el Kling clip: ${KLING_CLIP_PATH}`);
  console.error("");
  console.error("Genera el clip en Kling AI con el prompt del SalesAd v2");
  console.error("y guarda el MP4 en esa ruta antes de correr este script.");
  process.exit(1);
}
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function main() {
  console.log(`\n🎬 SalesAd v2 para screen ${screenId}`);
  console.log(`   Business: ${businessName}`);
  console.log(`   Signup URL: ${advertiserSignupUrl}\n`);

  // ── 1. Generar QR PNG + convertir a data URL ────────────────────────────
  // Igual approach que el Awakening: data URL embebido evita fetch externo
  // durante el Remotion render (que causaba issues en Fully Kiosk).
  console.log("📱 Generando QR PNG + convirtiendo a data URL...");
  const qrLocalPath = path.join(TMP, `sales-ad-v2-qr-${screenId}.png`);
  await QRCode.toFile(qrLocalPath, advertiserSignupUrl, {
    width: 800,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  const qrBytes = fs.readFileSync(qrLocalPath);
  const qrDataUrl = `data:image/png;base64,${qrBytes.toString("base64")}`;
  console.log(
    `✅ QR data URL (${(qrBytes.length / 1024).toFixed(1)} KB → embebido)`
  );

  // ── 2. Bundle Remotion ───────────────────────────────────────────────────
  console.log("\n📦 Bundling Remotion...");
  const bundleLocation = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    webpackOverride: (c) => c,
  });

  // ── 3. Render SalesAdV2 composition ─────────────────────────────────────
  console.log("\n🎬 Renderizando SalesAdV2 composition...");
  const inputProps = {
    klingClipPath: KLING_CLIP_FILENAME,
    qrUrl: qrDataUrl,
    businessName,
  };
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SalesAdV2",
    inputProps,
  });
  const rawPath = path.join(OUT, `sales-ad-v2-raw-${screenId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: rawPath,
    inputProps,
    // Remotion outputeará audio del Kling clip embebido (Kling clip viene
    // sin audio → output Remotion también sin audio). El post-process
    // agrega AAC silente.
    audioCodec: null,
    pixelFormat: "yuv420p",
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
    },
  });
  console.log(`\n✅ Render bruto → ${rawPath}`);

  // ── 4. Re-encode Android-safe con AAC silente ───────────────────────────
  // IDÉNTICO al post-process del Awakening teaser que funciona en Fully
  // Kiosk: Baseline + bf=0 + yuv420p + BT.709 + AAC silente + 30fps +
  // faststart.
  console.log("\n🔧 Re-encode Android-safe con AAC silente...");
  const finalPath = path.join(OUT, `sales-ad-v2-${screenId}.mp4`);
  await runFfmpeg(
    [
      "-y",
      "-i", rawPath,
      "-f", "lavfi",
      "-i", "aevalsrc=0:channel_layout=stereo:sample_rate=48000",
      "-map", "0:v",
      "-map", "1:a",
      "-c:v", "libx264",
      "-profile:v", "baseline",
      "-level", "4.0",
      "-pix_fmt", "yuv420p",
      "-bf", "0",
      "-preset", "fast",
      "-crf", "23",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-colorspace", "bt709",
      // Keyframe forzado cada 60 frames (2 segundos a 30fps). Sin esto
      // libx264 usa GOP=150+ por default, lo que genera stuttering en
      // el hardware decoder del Onn stick — para cada P-frame el decoder
      // debe mantener 150 frames de estado en memoria, sobrecarga
      // brutal. Con GOP=60, el decoder se resetea cada 2s, carga
      // sostenible. Ver diagnóstico en debug overlay logs.
      "-g", "60",
      "-keyint_min", "60",
      "-sc_threshold", "0",
      "-r", "30",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      finalPath,
    ],
    "re-encode Android-safe (GOP=60 para evitar decoder stutter)"
  );

  // ── 5. Upload a Storage ─────────────────────────────────────────────────
  console.log("\n☁️  Subiendo MP4 final a Storage...");
  const videoStoragePath = `partner-sales-ads-v2/${screenId}.mp4`;
  const videoPublicUrl = await uploadToStorage(
    "ad-media",
    videoStoragePath,
    fs.readFileSync(finalPath),
    "video/mp4"
  );

  // ── 6. Reemplazar SalesAd anterior en la tabla ads ─────────────────────
  // Mismo patrón que render.mjs: DELETE el SalesAd viejo del partner y
  // INSERT el nuevo apuntando al MP4 v2. El player lo recoge automático
  // via la query normal de ads (kind="ad", screen_id=partnerId).
  console.log("\n🗄️  Actualizando tabla ads (DELETE viejo + INSERT v2)...");
  await dbDelete("ads", {
    screen_id: screenId,
    advertiser_id: screenId,
  });
  await dbInsert("ads", {
    advertiser_id: screenId,
    screen_id: screenId,
    type: "video",
    final_media_path: videoPublicUrl,
    status: "published",
    qr_url: null,
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const stat = fs.statSync(finalPath);
  console.log(`\n✅ Done — ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Local: ${finalPath}`);
  console.log(`   URL:   ${videoPublicUrl}`);
  console.log(`   DB:    ads row insertado (replaza al SalesAd v1)`);

  // Cleanup
  try {
    fs.unlinkSync(rawPath);
    fs.unlinkSync(qrLocalPath);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
