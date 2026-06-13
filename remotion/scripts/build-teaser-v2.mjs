/**
 * build-teaser-v2.mjs
 *
 * Genera el teaser "The Awakening" v2 PER-PARTNER con un clip de Gemini Omni.
 * Reemplaza al teaser viejo (Kling A+B+C + AwakeningOutro inglés). Combina:
 *   - Clip de Omni (remotion/public/TeaserV2.mp4): silla-trono en el vacío,
 *     rayos + fuego + espejo + humo, burst de energía y transformaciones
 *     épicas (peluche, estatua griega, pixel-art, superhéroe). Pattern
 *     interrupt que rompe la secuencia de anuncios.
 *   - Outro Remotion (TeaserOutro, español): QR de selfie per-partner +
 *     "¿QUIÉN ERES HOY? / Escanea y conviértete en tu personaje".
 *
 * CLAVE: NO se le pone NADA encima al clip de Omni (cero overlay → cero
 * stuttering/PIPELINE_ERROR en el Onn stick). El outro se CONCATENA al final.
 * Mismo pipeline que el SalesAd v3. Audio SILENTE (las TVs van en mudo; el
 * audio del clip de Omni se descarta).
 *
 * El clip de Omni es 1280x720 @ 24fps; el output es 1920x1080 @ 30fps. SIN
 * hold — el teaser es dinámico y no tiene texto que leer al final, así que
 * corta directo del clip al outro (a diferencia del SalesAd v3, que sí
 * congela el último frame para dar tiempo de leer su tarjeta de texto).
 *
 * A diferencia del SalesAd: el teaser NO es una row de la tabla `ads` — el
 * player lo inyecta sintéticamente buscando el archivo en
 * partner-teasers/{screenId}.mp4. Por eso este script SOLO sube el MP4 a ese
 * path; no toca la DB. ⚠️ Bumpear TEASER_VERSION en PlayerPage.tsx tras
 * re-renderizar (cache-buster del WebView).
 *
 * Usage:
 *   node scripts/build-teaser-v2.mjs <screenId> <selfieUrl>
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Output: ad-media/partner-teasers/{screenId}.mp4
 *   - 1920x1080 @ 30fps, ~16s (10s Omni + 6s outro)
 *   - H.264 Constrained Baseline + yuv420p + sin B-frames + BT.709 + faststart
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

const OMNI_CLIP_FILENAME = "TeaserV2.mp4";
const OMNI_CLIP_PATH = path.join(PUBLIC, OMNI_CLIP_FILENAME);

// ── Args ─────────────────────────────────────────────────────────────────────
const [screenId, selfieUrl] = process.argv.slice(2);
if (!screenId || !selfieUrl) {
  console.error("Usage: node build-teaser-v2.mjs <screenId> <selfieUrl>");
  console.error("");
  console.error("Ejemplo:");
  console.error(
    "  node build-teaser-v2.mjs 154f35ed-ff6f-4354-978b-cff46a0b9f82 https://adscreenpro.com/selfie/154f35ed-ff6f-4354-978b-cff46a0b9f82",
  );
  process.exit(1);
}

// Validar inputs — vienen de workflow_dispatch.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(screenId)) {
  console.error(`❌ screenId inválido (debe ser UUID): ${screenId}`);
  process.exit(1);
}
if (!/^https:\/\//.test(selfieUrl)) {
  console.error(`❌ selfieUrl debe ser https: ${selfieUrl}`);
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

// ── ffmpeg helper ─────────────────────────────────────────────────────────────
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
if (!fs.existsSync(OMNI_CLIP_PATH)) {
  console.error(`❌ Falta el clip de Omni: ${OMNI_CLIP_PATH}`);
  console.error("");
  console.error("Genera el teaser en Gemini Omni y guárdalo en esa ruta antes.");
  process.exit(1);
}
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function main() {
  console.log(`\n🎬 Teaser v2 para screen ${screenId}`);
  console.log(`   Selfie URL: ${selfieUrl}\n`);

  // ── 1. Generar QR PNG + convertir a data URL ────────────────────────────
  console.log("📱 Generando QR PNG + convirtiendo a data URL...");
  const qrLocalPath = path.join(TMP, `teaser-v2-qr-${screenId}.png`);
  await QRCode.toFile(qrLocalPath, selfieUrl, {
    width: 800,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  const qrBytes = fs.readFileSync(qrLocalPath);
  const qrDataUrl = `data:image/png;base64,${qrBytes.toString("base64")}`;
  console.log(`✅ QR data URL (${(qrBytes.length / 1024).toFixed(1)} KB → embebido)`);

  // ── 2. Bundle Remotion ───────────────────────────────────────────────────
  console.log("\n📦 Bundling Remotion...");
  const bundleLocation = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    webpackOverride: (c) => c,
  });

  // ── 3. Render TeaserOutro (solo QR + texto, sin el clip de Omni) ────────
  console.log("\n🎬 Renderizando TeaserOutro (QR + ¿quién eres hoy?)...");
  const inputProps = { qrUrl: qrDataUrl };
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "TeaserOutro",
    inputProps,
  });
  const outroRawPath = path.join(OUT, `teaser-v2-outro-raw-${screenId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outroRawPath,
    inputProps,
    audioCodec: null,
    pixelFormat: "yuv420p",
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Progress: ${Math.round(progress * 100)}%`);
    },
  });
  console.log(`\n✅ Outro renderizado → ${outroRawPath}`);

  // ── 4. Concat clip Omni RAW + outro + re-encode Android-safe ────────────
  // El clip de Omni NO se toca con overlay; solo se normaliza (scale a 1080p,
  // fps 30, sar 1) y se concatena con el outro. Una sola re-encode. SIN hold
  // — corte directo del clip al outro (el teaser es dinámico, sin texto que
  // leer al final).
  //
  // Audio: track silente (aevalsrc) mapeado con -shortest. Idéntico al v3;
  // el audio del clip de Omni se descarta (las TVs de barbería van en mudo).
  console.log("\n🔧 Concat clip Omni + outro + re-encode Android-safe...");
  const finalPath = path.join(OUT, `teaser-v2-${screenId}.mp4`);
  await runFfmpeg(
    [
      "-y",
      "-i", OMNI_CLIP_PATH,   // 0: video (su audio se descarta)
      "-i", outroRawPath,     // 1: video
      "-f", "lavfi",
      "-i", "aevalsrc=0:channel_layout=stereo:sample_rate=48000", // 2: silencio
      "-filter_complex",
      "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];" +
        "[1:v]scale=1920:1080,setsar=1,fps=30[v1];" +
        "[v0][v1]concat=n=2:v=1:a=0[v]",
      "-map", "[v]",
      "-map", "2:a",
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
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      finalPath,
    ],
    "concat Omni + outro + re-encode (pipeline tipo v3)",
  );

  // ── 5. Upload a Storage (mismo path que el teaser viejo) ────────────────
  // El player busca el teaser en partner-teasers/{screenId}.mp4 (ver
  // TEASER_STORAGE_BASE en PlayerPage). Subir acá lo reemplaza. ⚠️ Bumpear
  // TEASER_VERSION en PlayerPage para que el WebView no sirva el viejo.
  console.log("\n☁️  Subiendo MP4 final a Storage (partner-teasers)...");
  const videoStoragePath = `partner-teasers/${screenId}.mp4`;
  const videoPublicUrl = await uploadToStorage(
    "ad-media",
    videoStoragePath,
    fs.readFileSync(finalPath),
    "video/mp4",
  );

  // ── Stats ────────────────────────────────────────────────────────────────
  const stat = fs.statSync(finalPath);
  console.log(`\n✅ Done — ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Local: ${finalPath}`);
  console.log(`   URL:   ${videoPublicUrl}`);
  console.log(`   ⚠️  Recuerda bumpear TEASER_VERSION en PlayerPage.tsx`);

  // Cleanup
  try {
    fs.unlinkSync(outroRawPath);
    fs.unlinkSync(qrLocalPath);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
