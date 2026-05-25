import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── Segmento D del teaser "The Awakening" ────────────────────────────────────
//
// Cierre del teaser cinemático. Va después de los 3 segmentos generados con
// Kling (A: ambient buildup, B: glow surge, C: character flashes). Su trabajo
// es transformar la atención que el teaser construyó en intención de escanear
// el QR que viene SEGUNDOS DESPUÉS en la rotación normal del player (widget
// selfie-cta).
//
// IMPORTANTE: NO hay QR real aquí. El "QR" es un patrón decorativo (grid de
// celdas que se revelan) — claramente artístico, no escaneable. Esto evita:
//   - render per-partner del MP4 (sería N renders cada vez que cambia un partner)
//   - que la gente intente escanear y caiga en un landing genérico confuso
// El QR real del partner se muestra ~3-5s después cuando el rotation entra al
// widget `selfie-cta`. El teaser construye anticipación; el widget convierte.
//
// Duración: 72 frames @ 24fps = 3.0s. Matchea fps de los segmentos Kling para
// no introducir interpolación al stitching.
//
// Timeline (72 frames totales):
//   0-30   (0-1.25s): "WHO ARE YOU?" letra por letra
//   24-48  (1-2s):    Grid decorativo QR-style se materializa
//   42-66  (1.75-2.75s): "SCAN TO UNLOCK YOUR CHARACTER" + flecha ↓
//   60-72  (2.5-3s):  Pulse final de glow

// Paleta consistente con CinematicReveal (violet/fuchsia/amber)
const VIOLET = "#a78bfa";
const FUCHSIA = "#ec4899";
const AMBER = "#fbbf24";
const BG = "#000";

// Grid del "QR" decorativo. 13x13 = 169 celdas. Patrón pseudoaleatorio pero
// determinístico (cada celda tiene un delay de aparición fijo) para que el
// render sea reproducible.
const QR_GRID_SIZE = 13;
const QR_CELLS = Array.from({ length: QR_GRID_SIZE * QR_GRID_SIZE }, (_, i) => {
  // Patrón pseudoaleatorio basado en sin/cos del índice. Da ~50% celdas filled.
  const x = i % QR_GRID_SIZE;
  const y = Math.floor(i / QR_GRID_SIZE);
  // Esquinas tipo QR finder pattern (siempre filled — refuerza la lectura "QR")
  const isCornerFinder =
    (x < 3 && y < 3) ||
    (x >= QR_GRID_SIZE - 3 && y < 3) ||
    (x < 3 && y >= QR_GRID_SIZE - 3);
  // Resto: pseudoaleatorio
  const noise = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  const filled = isCornerFinder || (noise - Math.floor(noise)) > 0.5;
  // Delay de aparición barre de arriba-izq a abajo-der + jitter
  const revealDelay = 24 + (x + y) * 0.5 + ((noise - Math.floor(noise)) * 8);
  return { x, y, filled, revealDelay };
});

export const AwakeningOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Texto 1: "WHO ARE YOU?" letra por letra ──────────────────────────────
  const T_HEADLINE = 0;
  const headline = "WHO ARE YOU?";
  const CHAR_DELAY = 2.5; // frames entre letras (rápido — 0.1s entre cada una)

  // ── Grid QR decorativo ────────────────────────────────────────────────────
  // Las celdas individuales tienen su propio delay (ver QR_CELLS arriba).
  // El contenedor entra con scale+opacity.
  const T_QR_GRID = 24;
  const qrContainerProgress = spring({
    frame: frame - T_QR_GRID,
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const qrContainerScale = interpolate(qrContainerProgress, [0, 1], [0.7, 1]);
  const qrContainerOpacity = interpolate(qrContainerProgress, [0, 1], [0, 1]);

  // ── Texto 2: "SCAN TO UNLOCK YOUR CHARACTER" + flecha ─────────────────────
  const T_CTA = 42;
  const ctaProgress = spring({
    frame: frame - T_CTA,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const ctaY = interpolate(ctaProgress, [0, 1], [20, 0]);
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);

  // Flecha pulsando (continuo)
  const arrowPulse = 1 + Math.sin((frame - T_CTA) * 0.25) * 0.15;

  // ── Glow pulse final ──────────────────────────────────────────────────────
  const T_FINAL_PULSE = 60;
  const finalPulse = interpolate(
    frame,
    [T_FINAL_PULSE, T_FINAL_PULSE + 8, 72],
    [0, 0.4, 0.15],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Headline char-by-char render ──────────────────────────────────────────
  const headlineChars = headline.split("").map((char, i) => {
    const cf = frame - T_HEADLINE - i * CHAR_DELAY;
    const cp = spring({
      frame: cf,
      fps,
      config: { damping: 12, stiffness: 130 },
    });
    const cy = interpolate(cp, [0, 1], [-40, 0]);
    const co = interpolate(cp, [0, 1], [0, 1]);
    const cBlur = interpolate(cp, [0, 1], [12, 0]);
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          transform: `translateY(${cy}px)`,
          opacity: co,
          filter: `blur(${cBlur}px)`,
          color: "#fff",
          // Mantén el ancho del espacio aun cuando char=" "
          width: char === " " ? "0.4em" : undefined,
        }}
      >
        {char === " " ? " " : char}
      </span>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: "hidden" }}>
      {/* ── Glow radial central (intensifica con el pulse final) ── */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${VIOLET}${Math.round(
            (0.15 + finalPulse) * 255
          )
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />

      {/* ── Partículas ascendentes (consistencia con CinematicReveal) ── */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.4 }}>
        {[...Array(20)].map((_, i) => {
          const speed = 8 + (i % 5);
          // Movimiento continuo basado en frame — sin loops CSS (Remotion
          // renderiza frame por frame, las animaciones CSS no se aplican)
          const t = (frame / fps + i * 0.5) / speed;
          const y = 100 - ((t * 100) % 120);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i * 47) % 100}%`,
                top: `${y}%`,
                width: 2,
                height: 2,
                borderRadius: "50%",
                backgroundColor: VIOLET,
                opacity: 0.6,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* ── Layout vertical: headline arriba, QR centro, CTA abajo ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 60,
          padding: "80px 120px",
        }}
      >
        {/* ── Headline "WHO ARE YOU?" ── */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 160,
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            lineHeight: 1,
            textShadow: `0 0 60px ${VIOLET}99, 0 0 30px ${FUCHSIA}66`,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {headlineChars}
        </div>

        {/* ── QR-style decorative grid ── */}
        <div
          style={{
            transform: `scale(${qrContainerScale})`,
            opacity: qrContainerOpacity,
            padding: 32,
            background: "rgba(255,255,255,0.05)",
            border: `2px solid ${VIOLET}66`,
            borderRadius: 16,
            boxShadow: `0 0 80px ${VIOLET}55, inset 0 0 30px ${FUCHSIA}22`,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${QR_GRID_SIZE}, 18px)`,
              gridTemplateRows: `repeat(${QR_GRID_SIZE}, 18px)`,
              gap: 2,
            }}
          >
            {QR_CELLS.map((cell, i) => {
              if (!cell.filled) {
                return <div key={i} style={{ width: 18, height: 18 }} />;
              }
              const cellAge = frame - cell.revealDelay;
              const cellOpacity = interpolate(cellAge, [0, 4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const cellScale = interpolate(cellAge, [0, 4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: "#fff",
                    opacity: cellOpacity,
                    transform: `scale(${cellScale})`,
                    boxShadow: `0 0 4px ${VIOLET}88`,
                  }}
                />
              );
            })}
          </div>

          {/* Etiqueta "NOT A REAL QR" — muy sutil para anti-confusion */}
          {/* Comentado: en pruebas se vio que distrae. Si los partners */}
          {/* reportan que la gente intenta escanear, descomentar.       */}
          {/* <div style={{ position:"absolute", bottom:-26, left:0, right:0, */}
          {/*   textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.3)", */}
          {/*   letterSpacing:"0.3em", textTransform:"uppercase" }}>            */}
          {/*   decorative                                                       */}
          {/* </div>                                                             */}
        </div>

        {/* ── CTA + flecha ── */}
        <div
          style={{
            transform: `translateY(${ctaY}px)`,
            opacity: ctaOpacity,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "transparent",
              backgroundImage: `linear-gradient(90deg, ${VIOLET}, ${FUCHSIA}, ${AMBER})`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              filter: `drop-shadow(0 0 20px ${FUCHSIA}66)`,
              marginBottom: 12,
            }}
          >
            Get Your Phone Ready
          </div>
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <span style={{ transform: `scale(${arrowPulse})` }}>↓</span>
            Scan to Unlock Your Character
            <span style={{ transform: `scale(${arrowPulse})` }}>↓</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
