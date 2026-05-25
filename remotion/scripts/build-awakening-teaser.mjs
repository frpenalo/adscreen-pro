/**
 * build-awakening-teaser.mjs
 *
 * Genera el video "The Awakening" PER-PARTNER. El Segmento D contiene un QR
 * real que apunta a /selfie/:screenId, así que cada partner necesita su
 * propio MP4. Sigue exactamente el patrón de render.mjs (SalesAd).
 *
 * Pipeline:
 *   1. Genera QR PNG local apuntando a la URL del selfie del partner
 *   2. Sube QR a Supabase Storage → URL pública
 *   3. Bundle Remotion (cached entre runs)
 *   4. Renderiza AwakeningOutro composition con qrUrl=URL_DEL_QR
 *   5. Concat A+B+C+D vía ffmpeg con re-encode Android-safe en un pase
 *   6. Sube MP4 final a Supabase Storage en partner-teasers/{screenId}.mp4
 *
 * Usage:
 *   node scripts/build-awakening-teaser.mjs <screenId> <selfieUrl>
 *
 *   Ejemplo:
 *     node scripts/build-awakening-teaser.mjs \
 *       6e9f3a2c-1234-5678-90ab-cdef01234567 \
 *       https://app.adscreenpro.com/selfie/6e9f3a2c-1234-5678-90ab-cdef01234567
 *
 * Env vars requeridos (mismo set que render.mjs):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Output final: ad-media/partner-teasers/{screenId}.mp4 (public URL)
 *   - 1920x1080 @ 24fps, ~21s total (5+5+5+6)
 *   - H.264 Constrained Baseline + yuv420p + sin B-frames + keyint 1s + faststart
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
const ASSETS = path.join(ROOT, "assets", "awakening");
const OUT = path.join(ROOT, "out");
const TMP = os.tmpdir();

const KLING_FILES = [
  path.join(ASSETS, "awakening 1.mp4"),
  path.join(ASSETS, "awakening 2.mp4"),
  path.join(ASSETS, "awakening 3.mp4"),
];

// ── Args ─────────────────────────────────────────────────────────────────────
const [screenId, selfieUrl] = process.argv.slice(2);
if (!screenId || !selfieUrl) {
  console.error("Usage: node build-awakening-teaser.mjs <screenId> <selfieUrl>");
  console.error("  Ejemplo:");
  console.error("    node build-awakening-teaser.mjs abc123 https://app.adscreenpro.com/selfie/abc123");
  process.exit(1);
}

// ── Supabase REST helpers (idéntico al patrón de render.mjs) ─────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
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
for (const f of KLING_FILES) {
  if (!fs.existsSync(f)) {
    console.error(`❌ Falta segmento Kling: ${f}`);
    process.exit(1);
  }
}
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function main() {
  console.log(`\n🎬 Awakening Teaser para screen ${screenId}`);
  console.log(`   Selfie URL: ${selfieUrl}\n`);

  // ── 1. Generar QR PNG local + convertir a data URL ────────────────────────
  // GPT-suggested fix (hipótesis 70% del bug "pantalla negra en TV"):
  // antes pasábamos qrUrl=<URL pública de Supabase> a Remotion. Durante
  // el render, Remotion's <Img src={qrUrl}> hace fetch HTTP a esa URL.
  // Si hay timeout, frame parcial, o cualquier irregularidad → frame
  // corrupto que Chrome desktop tolera pero Android WebView/Fully Kiosk
  // rechaza completo → black screen.
  // Fix: leer el PNG localmente, convertir a base64 data URL, embeber
  // en el inputProp. Remotion no hace network fetch, el QR está garan-
  // tizado integro en cada frame. Mismo approach que `staticFile()` pero
  // sin gestión de archivos en /public/.
  console.log("📱 Generando QR PNG + convirtiendo a data URL...");
  const qrLocalPath = path.join(TMP, `awakening-qr-${screenId}.png`);
  await QRCode.toFile(qrLocalPath, selfieUrl, {
    width: 800,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  const qrBytes = fs.readFileSync(qrLocalPath);
  const qrDataUrl = `data:image/png;base64,${qrBytes.toString("base64")}`;
  console.log(`✅ QR data URL (${(qrBytes.length / 1024).toFixed(1)} KB → embebido)`);

  // (SACADO el upload del QR a Storage — ya no se referencia desde lado
  // del player. Si quisiéramos exponer el QR como archivo, lo agregamos
  // aparte; por ahora solo necesitamos pasarlo a Remotion.)

  // ── 2. Bundle Remotion ─────────────────────────────────────────────────────
  console.log("\n📦 Bundling Remotion...");
  const bundleLocation = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    webpackOverride: (c) => c,
  });

  // ── 3. Render AwakeningOutro con QR data URL ───────────────────────────────
  console.log("\n🎬 Renderizando AwakeningOutro...");
  const inputProps = { qrUrl: qrDataUrl };
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "AwakeningOutro",
    inputProps,
  });
  const outroRawPath = path.join(OUT, `awakening-outro-raw-${screenId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outroRawPath,
    inputProps,
    audioCodec: null,        // teaser es silent
    pixelFormat: "yuv420p",
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
    },
  });
  console.log(`\n✅ Outro renderizado → ${outroRawPath}`);

  // ── 5. Concat A+B+C+D + Android-safe re-encode ────────────────────────────
  // Usamos concat filter (no demuxer) porque los 4 archivos tienen distintos
  // encoders/bitrates. Mismos flags que reEncodeForAndroid() de render.mjs.
  const finalPath = path.join(OUT, `awakening-teaser-${screenId}.mp4`);
  console.log("\n🔗 Concatenando A+B+C+D con re-encode Android-safe...");
  // Encoding match a render.mjs (SalesAd) — pero SIN audio porque el
  // teaser es 100% silente por diseño (TVs en barberías están muted +
  // ambient music alto). Hipótesis GPT: agregar audio AAC artificial
  // fue contraproducente. Mejor MP4 video-only explícito (-an).
  //
  // Settings:
  //   - profile baseline + level 4.0 + yuv420p + bf=0 + faststart
  //   - color tags BT.709 (sino algunos Android WebView asumen BT.601
  //     → mapeo incorrecto, escenas oscuras colapsan a negro)
  //   - -r 30 fps (matchea SalesAd que funciona en TV)
  //   - -an explícito = NO audio stream
  await runFfmpeg(
    [
      "-y",
      "-i", KLING_FILES[0],
      "-i", KLING_FILES[1],
      "-i", KLING_FILES[2],
      "-i", outroRawPath,
      "-filter_complex", "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]",
      "-map", "[v]",
      "-an",
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
      "-r", "30",
      "-movflags", "+faststart",
      finalPath,
    ],
    "concat + re-encode Android-safe (video-only, sin audio)"
  );

  // ── 6. Subir MP4 final a Storage ───────────────────────────────────────────
  console.log("\n☁️  Subiendo MP4 final a Storage...");
  const videoStoragePath = `partner-teasers/${screenId}.mp4`;
  const videoPublicUrl = await uploadToStorage(
    "ad-media",
    videoStoragePath,
    fs.readFileSync(finalPath),
    "video/mp4"
  );

  // ── Stats ────────────────────────────────────────────────────────────────
  const stat = fs.statSync(finalPath);
  console.log(`\n✅ Done — ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Local: ${finalPath}`);
  console.log(`   URL:   ${videoPublicUrl}`);

  // Cleanup outro-raw (no necesitamos guardarlo)
  try {
    fs.unlinkSync(outroRawPath);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
