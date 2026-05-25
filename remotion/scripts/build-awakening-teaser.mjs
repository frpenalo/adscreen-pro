/**
 * build-awakening-teaser.mjs
 *
 * Genera el video completo "The Awakening" combinando los 3 segmentos
 * de Kling (assets/awakening/awakening 1|2|3.mp4) + el Segmento D
 * renderizado en Remotion (composition "AwakeningOutro").
 *
 * Output final: out/awakening-teaser.mp4
 *   - 1920x1080 @ 24fps
 *   - ~18s total (5s + 5s + 5s + 3s)
 *   - H.264 Baseline + yuv420p + sin B-frames + keyframe cada 1s + faststart
 *     (settings probados para Android WebView en sticks baratos / Fully Kiosk)
 *
 * Pasos:
 *   1. Bundle de Remotion (1 sola vez)
 *   2. Render de la composition AwakeningOutro → out/awakening-outro-raw.mp4
 *   3. Concat A + B + C + D usando ffmpeg concat filter (decodifica + re-encode
 *      todos los inputs en un solo pase para normalizar streams)
 *   4. Output ya queda Android-safe (los flags de baseline van en el mismo
 *      paso, no necesitamos un re-encode adicional)
 *
 * Usage:
 *   node scripts/build-awakening-teaser.mjs
 *
 * (Sin args. Todo es estático — los assets de Kling viven en el repo y
 *  la composition no requiere props.)
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "assets", "awakening");
const OUT = path.join(ROOT, "out");

const KLING_FILES = [
  path.join(ASSETS, "awakening 1.mp4"),
  path.join(ASSETS, "awakening 2.mp4"),
  path.join(ASSETS, "awakening 3.mp4"),
];
const OUTRO_RAW = path.join(OUT, "awakening-outro-raw.mp4");
const FINAL = path.join(OUT, "awakening-teaser.mp4");

// ── Helpers ──────────────────────────────────────────────────────────────────
function runFfmpeg(args, label = "ffmpeg") {
  console.log(`\n→ ${label}:`);
  console.log("  " + args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" "));
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

// ── 1. Bundle Remotion ───────────────────────────────────────────────────────
console.log("📦 Bundling Remotion...");
const bundleLocation = await bundle({
  entryPoint: path.join(ROOT, "src", "index.ts"),
  webpackOverride: (c) => c,
});

// ── 2. Render AwakeningOutro ─────────────────────────────────────────────────
console.log("\n🎬 Rendering AwakeningOutro composition...");
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "AwakeningOutro",
});
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  outputLocation: OUTRO_RAW,
  // No usamos audio en este segmento — el teaser entero será silent
  audioCodec: null,
  pixelFormat: "yuv420p",
});
console.log(`✓ Outro renderizado → ${OUTRO_RAW}`);

// ── 3. Concat A + B + C + D con re-encode Android-safe en un solo paso ──────
//
// Usamos el `concat filter` en lugar del `concat demuxer` porque:
//   - Los 4 archivos tienen distintos encoders/bitrates/timebase
//   - El filter decodifica + re-encodifica todo en un pase consistente
//   - El demuxer fallaría con "non-monotonous DTS" o glitches en frame 0
//     del corte si los streams no son idénticos
//
// Output queda Android-safe: Baseline, yuv420p, sin B-frames, keyframe 1s,
// faststart. Igual que reEncodeForAndroid() en render.mjs.
console.log("\n🔗 Concatenando A+B+C+D con re-encode Android-safe...");

// Construimos el filter_complex:
//   [0:v][1:v][2:v][3:v] concat=n=4:v=1:a=0 [v]
// Sin audio (a=0) porque el teaser es silent.
const filterComplex = "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]";

await runFfmpeg(
  [
    "-y",
    "-i", KLING_FILES[0],
    "-i", KLING_FILES[1],
    "-i", KLING_FILES[2],
    "-i", OUTRO_RAW,
    "-filter_complex", filterComplex,
    "-map", "[v]",
    "-c:v", "libx264",
    "-profile:v", "baseline",
    "-level", "4.0",
    "-pix_fmt", "yuv420p",
    "-bf", "0",
    "-g", "24",              // keyframe cada 1s (24fps × 1)
    "-keyint_min", "24",
    "-sc_threshold", "0",
    "-preset", "slow",       // mejor compresión (es one-shot, no CI loop)
    "-crf", "21",            // calidad alta — es un teaser hero
    "-movflags", "+faststart",
    "-r", "24",              // forzar 24fps output (matchea Kling)
    FINAL,
  ],
  "concat + re-encode Android-safe"
);

// ── 4. Probe final ───────────────────────────────────────────────────────────
console.log("\n🔍 Specs del output final:");
const probe = spawn(ffmpegInstaller.path, ["-hide_banner", "-i", FINAL]);
let stderr = "";
probe.stderr.on("data", (d) => (stderr += d.toString()));
await new Promise((r) => probe.on("exit", r));
const interesting = stderr
  .split("\n")
  .filter((l) => /Duration|Stream #0|Video:/.test(l))
  .join("\n");
console.log(interesting);

const stat = fs.statSync(FINAL);
console.log(`\n✅ Done — ${FINAL} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
