/**
 * transcode-ad.mjs — Re-encode a direct-uploaded advertiser video to the
 * Android-safe profile before it airs on partner TVs.
 *
 * Los videos que el cliente sube desde su dashboard llegaban a las pantallas
 * TAL CUAL salían de su teléfono (HEVC de iPhone, high-profile H.264, 4K…) —
 * exactamente el perfil que congela el WebView del Onn stick (PIPELINE_ERROR,
 * mayo 2026). Este script les aplica la misma "traducción" Android-safe que
 * ya usan todos los videos generados por nosotros.
 *
 * Usage:
 *   node scripts/transcode-ad.mjs <ad_id> <video_url>
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
// GH Actions runners no longer ship ffmpeg in PATH — use the npm
// package that bundles a static binary cross-platform.
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

// ── Args ──────────────────────────────────────────────────────────────────────
const [adId, videoUrl] = process.argv.slice(2);

if (!adId || !videoUrl) {
  console.error("Usage: node transcode-ad.mjs <ad_id> <video_url>");
  process.exit(1);
}

// Validar inputs — vienen de workflow_dispatch y adId termina en filtros
// de PATCH contra la DB con service role.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(adId)) {
  console.error(`Invalid ad_id (must be UUID): ${adId}`);
  process.exit(1);
}
// Solo transcodificamos archivos de NUESTRO storage — este workflow no debe
// poder usarse para descargar URLs arbitrarias.
if (!/^https:\/\/.+\/storage\/v1\/object\/public\/ad-media\//.test(videoUrl)) {
  console.error(`Invalid video_url (must be a public ad-media storage URL): ${videoUrl}`);
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
  // URLSearchParams encodea los valores — evita inyección de filtros PostgREST.
  const params = new URLSearchParams(
    Object.entries(filters).map(([k, v]) => [k, `eq.${v}`]),
  );
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

// Android-safe re-encode: Constrained Baseline + yuv420p + sin B-frames +
// BT.709 + 30fps + faststart — el mismo perfil blindado de los renders
// (ver render-advertiser-ad.mjs). Extra para material de cliente:
// - scale a máx 1920 de ancho (un 4K de iPhone violaría level 4.0)
// - fps cap a 30 (los teléfonos graban a 60)
async function reEncodeForAndroid(inputPath, outputPath) {
  console.log("Re-encoding for Android-WebView compatibility...");
  const args = [
    "-y",
    "-i", inputPath,
    "-vf", "scale='min(1920,iw)':-2",
    "-r", "30",
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
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath,
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegInstaller.path, args, { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg re-encode failed with exit code ${code}`));
    });
  });
}

const tmpDir = os.tmpdir();

async function main() {
  console.log(`\nTranscoding direct-upload video for ad: ${adId}`);

  // ── 1. Download the raw upload ────────────────────────────────────────────
  console.log("Downloading raw video...");
  const rawRes = await fetch(videoUrl);
  if (!rawRes.ok) throw new Error(`Download failed (${rawRes.status})`);
  const rawPath = path.join(tmpDir, `ad-raw-${adId}`);
  fs.writeFileSync(rawPath, Buffer.from(await rawRes.arrayBuffer()));
  console.log(`Downloaded ${fs.statSync(rawPath).size} bytes`);

  // ── 2. Re-encode Android-safe ─────────────────────────────────────────────
  const safePath = path.join(tmpDir, `ad-safe-${adId}.mp4`);
  await reEncodeForAndroid(rawPath, safePath);
  console.log("Re-encoded:", safePath);

  // ── 3. Upload final MP4 ───────────────────────────────────────────────────
  console.log("Uploading transcoded video...");
  const storagePath = `advertiser-ads/${adId}.mp4`;
  const publicUrl = await uploadToStorage(
    "ad-media",
    storagePath,
    fs.readFileSync(safePath),
    "video/mp4"
  );
  console.log("Video URL:", publicUrl);

  // ── 4. Update ad record ───────────────────────────────────────────────────
  console.log("Updating ads table...");
  await dbPatch("ads", { id: adId }, { final_media_path: publicUrl, render_status: "done" });
  console.log("Ad record updated");

  // ── 5. Delete the raw staging upload (best-effort) ────────────────────────
  try {
    const rawStoragePath = videoUrl.split("/storage/v1/object/public/ad-media/")[1];
    if (rawStoragePath && rawStoragePath !== storagePath) {
      await fetch(`${supabaseUrl}/storage/v1/object/ad-media/${rawStoragePath}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      console.log("Raw upload cleaned up");
    }
  } catch (e) {
    console.error("Raw cleanup skipped:", e.message);
  }

  // ── 6. Cleanup temp files ─────────────────────────────────────────────────
  fs.unlinkSync(rawPath);
  if (fs.existsSync(safePath)) fs.unlinkSync(safePath);

  console.log(`\nDone! Direct-upload video transcoded for ad_id: ${adId}`);
}

main().catch(async (err) => {
  console.error("\nTranscode failed:", err.message);
  // Best-effort: marcar el ad como fallido y avisar al admin (mismo patrón
  // que render-advertiser-ad.mjs) — sin esto el ad queda mudo en draft.
  try {
    await dbPatch("ads", { id: adId }, { render_status: "failed" });
    const res = await fetch(`${supabaseUrl}/rest/v1/admin_notifications`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({
        type: "render_failed",
        message: `La optimización del video subido (ad ${adId}) falló: ${err.message}`.slice(0, 500),
      }),
    });
    if (!res.ok) console.error("Admin notification failed:", res.status, await res.text());
  } catch (e) {
    console.error("Could not mark ad as failed:", e.message);
  }
  process.exit(1);
});
