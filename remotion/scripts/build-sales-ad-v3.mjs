/**
 * build-sales-ad-v3.mjs
 *
 * Genera el SalesAd v3 PER-PARTNER. Combina:
 *   - Clip de Gemini Omni (remotion/public/SalesAdV3.mp4): recorrido
 *     cinematográfico fachada → entrada → pasillo → pantalla, con la pantalla
 *     mostrando 3 anuncios (pizza/yoga/dentista) y cerrando con la tarjeta
 *     "TU ANUNCIO PUEDE APARECER EN ESTA PANTALLA / y en otras alrededor de
 *     la ciudad". Todo el texto ya viene quemado por Omni. CON audio ambiente.
 *   - Outro Remotion (SalesAdV3Outro): QR per-partner + invitación "Sé parte
 *     de la nueva forma de hacer publicidad en la ciudad".
 *
 * CLAVE: NO se le pone NADA encima al clip de Omni (cero overlay → cero
 * stuttering/PIPELINE_ERROR en el Onn stick). El outro se CONCATENA al final,
 * mismo pipeline que el teaser y el SalesAd v2 que corren fluidos.
 *
 * El clip de Omni es 1280x720 @ 24fps; el output final es 1920x1080 @ 30fps
 * (se escala el Omni y se normaliza el fps en el concat, una sola re-encode).
 * Audio: se preserva el del clip de Omni + silencio para el tramo del outro.
 *
 * Usage:
 *   node scripts/build-sales-ad-v3.mjs \
 *     <screenId> <businessName> <advertiserSignupUrl>
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Output: ad-media/partner-sales-ads-v3/{screenId}.mp4
 *   - 1920x1080 @ 30fps, ~16s (10s Omni + 6s outro)
 *   - H.264 Constrained Baseline + yuv420p + sin B-frames + AAC + BT.709
 *     + faststart
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

// El clip de Omni vive acá. El user lo sube manualmente una vez (commiteado).
const OMNI_CLIP_FILENAME = "SalesAdV3.mp4";
const OMNI_CLIP_PATH = path.join(PUBLIC, OMNI_CLIP_FILENAME);

// ── Args ─────────────────────────────────────────────────────────────────────
const [screenId, businessName, advertiserSignupUrl] = process.argv.slice(2);
if (!screenId || !businessName || !advertiserSignupUrl) {
  console.error(
    "Usage: node build-sales-ad-v3.mjs <screenId> <businessName> <advertiserSignupUrl>",
  );
  console.error("");
  console.error("Ejemplo:");
  console.error(
    '  node build-sales-ad-v3.mjs abc123 "Softmedia Barbería" "https://adscreenpro.com/register?role=advertiser&ref=REF-ABC12345"',
  );
  process.exit(1);
}

// Validar inputs — vienen de workflow_dispatch y screenId termina en filtros
// de DELETE contra la DB con service role.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(screenId)) {
  console.error(`❌ screenId inválido (debe ser UUID): ${screenId}`);
  process.exit(1);
}
if (!/^https:\/\//.test(advertiserSignupUrl)) {
  console.error(`❌ advertiserSignupUrl debe ser https: ${advertiserSignupUrl}`);
  process.exit(1);
}
if (businessName.length > 100) {
  console.error("❌ businessName demasiado largo (máx 100 chars)");
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
  const params = new URLSearchParams(
    Object.entries(filters).map(([k, v]) => [k, `eq.${v}`]),
  );
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
    method: "DELETE",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`DB delete failed (${res.status}) on ${table}`);
}

async function dbInsert(table, row) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB insert failed (${res.status}): ${err}`);
  }
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
  console.error("Genera el clip en Gemini Omni y guárdalo en esa ruta antes.");
  process.exit(1);
}
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function main() {
  console.log(`\n🎬 SalesAd v3 para screen ${screenId}`);
  console.log(`   Business: ${businessName}`);
  console.log(`   Signup URL: ${advertiserSignupUrl}\n`);

  // ── 1. Generar QR PNG + convertir a data URL ────────────────────────────
  console.log("📱 Generando QR PNG + convirtiendo a data URL...");
  const qrLocalPath = path.join(TMP, `sales-ad-v3-qr-${screenId}.png`);
  await QRCode.toFile(qrLocalPath, advertiserSignupUrl, {
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

  // ── 3. Render SalesAdV3Outro (solo QR + texto, sin el clip de Omni) ─────
  console.log("\n🎬 Renderizando SalesAdV3Outro (QR + invitación)...");
  const inputProps = { qrUrl: qrDataUrl, businessName };
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SalesAdV3Outro",
    inputProps,
  });
  const outroRawPath = path.join(OUT, `sales-ad-v3-outro-raw-${screenId}.mp4`);
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
  // fps 30, sar 1) y se concatena con el outro. Una sola re-encode. Mismo
  // pipeline que el teaser/v2 que corren fluidos en el Onn stick.
  //
  // Audio: el clip de Omni trae ambiente (input 0). El outro no tiene audio,
  // así que se le genera silencio (input 2) y se concatena el audio también.
  console.log("\n🔧 Concat clip Omni + outro + re-encode Android-safe...");
  const finalPath = path.join(OUT, `sales-ad-v3-${screenId}.mp4`);
  await runFfmpeg(
    [
      "-y",
      "-i", OMNI_CLIP_PATH,   // 0: video + audio ambiente
      "-i", outroRawPath,     // 1: video (sin audio)
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", // 2: silencio para el outro
      "-filter_complex",
      // Normalizar ambos videos al mismo formato antes de concatenar.
      "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];" +
        "[1:v]scale=1920:1080,setsar=1,fps=30[v1];" +
        // Audio: del Omni (0:a) para su tramo; silencio (2:a) recortado a 6s
        // (la duración del outro) para el tramo del outro.
        "[2:a]atrim=duration=6,asetpts=PTS-STARTPTS[sil];" +
        "[0:a]asetpts=PTS-STARTPTS[a0];" +
        "[v0][a0][v1][sil]concat=n=2:v=1:a=1[v][a]",
      "-map", "[v]",
      "-map", "[a]",
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
      "-movflags", "+faststart",
      finalPath,
    ],
    "concat Omni + outro + re-encode (pipeline tipo teaser/v2)",
  );

  // ── 5. Upload a Storage ─────────────────────────────────────────────────
  console.log("\n☁️  Subiendo MP4 final a Storage...");
  const videoStoragePath = `partner-sales-ads-v3/${screenId}.mp4`;
  const videoPublicUrl = await uploadToStorage(
    "ad-media",
    videoStoragePath,
    fs.readFileSync(finalPath),
    "video/mp4",
  );

  // ── 6. Reemplazar SalesAd anterior en la tabla ads ─────────────────────
  // Mismo patrón que v2: DELETE el SalesAd viejo del partner + INSERT el v3.
  // El player lo recoge automático via la query normal de ads.
  console.log("\n🗄️  Actualizando tabla ads (DELETE viejo + INSERT v3)...");
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
  console.log(`   DB:    ads row insertado (reemplaza al SalesAd anterior)`);

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
