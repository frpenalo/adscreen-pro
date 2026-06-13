import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── TeaserOutro — cierre del teaser v2 (Gemini Omni) en español ─────────────
//
// Va DESPUÉS del clip de Omni (silla-trono + rayos + espejo + humo +
// transformaciones épicas: peluche, estatua griega, pixel-art, superhéroe).
// El build concatena clip Omni RAW + este outro — sin overlay encima del
// clip (cero stuttering/PIPELINE_ERROR en el Onn stick). Mismo pipeline que
// el SalesAd v3.
//
// Convierte la atención que construyó el teaser en SCAN del QR de selfie:
// el QR es REAL y apunta a /selfie/:screenId (el cliente se transforma con
// IA y aparece en pantalla). Reemplaza al AwakeningOutro inglés.
//
// Duración: 180 frames @ 30fps = 6s. El concat ffmpeg unifica todo a 30fps.
//
// Per-partner via inputProps: qrUrl (data URL del QR de selfie).
//
// Timeline:
//   0-24f   (0-0.8s):  "¿QUIÉN ERES HOY?" letra por letra
//   24-48f  (0.8-1.6s): "Escanea y conviértete en tu personaje"
//   42-84f  (1.4-2.8s): QR scale-in con glow
//   72-180f (2.4-6s):  estable, QR escaneable (~3.6s ventana de scan)

const VIOLET = "#a78bfa";
const FUCHSIA = "#ec4899";
const AMBER = "#fbbf24";
const CREAM = "#fef3c7";

interface TeaserOutroProps {
  qrUrl: string;
}

export const TeaserOutro: React.FC<TeaserOutroProps> = ({ qrUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Headline "¿QUIÉN ERES HOY?" letra por letra ──────────────────────────
  const T_HEADLINE = 0;
  const headline = "¿QUIÉN ERES HOY?";
  const CHAR_DELAY = 2;

  // ── Subtítulo CTA ─────────────────────────────────────────────────────────
  const T_CTA = 24;
  const ctaProgress = spring({
    frame: frame - T_CTA,
    fps,
    config: { damping: 16, stiffness: 90 },
  });
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const ctaY = interpolate(ctaProgress, [0, 1], [20, 0]);

  // ── QR scale-in ──────────────────────────────────────────────────────────
  const T_QR = 42;
  const qrProgress = spring({
    frame: frame - T_QR,
    fps,
    config: { damping: 16, stiffness: 85 },
  });
  const qrScale = interpolate(qrProgress, [0, 1], [0.7, 1]);
  const qrOpacity = interpolate(qrProgress, [0, 1], [0, 1]);
  const qrPulse = 1 + Math.sin((frame - T_QR) * 0.12) * 0.015;

  // ── Footer (aparece tras el QR) ──────────────────────────────────────────
  const T_FOOTER = 60;
  const footerProgress = interpolate(frame, [T_FOOTER, T_FOOTER + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Ambient glow violeta pulsante ────────────────────────────────────────
  const ambientGlow = 0.2 + Math.sin(frame * 0.06) * 0.06;

  const headlineChars = headline.split("").map((char, i) => {
    const cf = frame - T_HEADLINE - i * CHAR_DELAY;
    const cp = spring({ frame: cf, fps, config: { damping: 12, stiffness: 130 } });
    const cy = interpolate(cp, [0, 1], [-40, 0]);
    const co = interpolate(cp, [0, 1], [0, 1]);
    const cBlur = interpolate(cp, [0, 1], [10, 0]);
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          transform: `translateY(${cy}px)`,
          opacity: co,
          filter: `blur(${cBlur}px)`,
          color: "#fff",
          width: char === " " ? "0.3em" : undefined,
        }}
      >
        {char === " " ? " " : char}
      </span>
    );
  });

  const QR_SIZE = 300;

  return (
    // Fondo negro con glow violeta — bridge desde el clip oscuro/eléctrico.
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* Glow radial central */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 45%, ${VIOLET}${Math.round(
            ambientGlow * 255,
          )
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />

      {/* Partículas ascendentes violeta/fucsia */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.45 }}>
        {[...Array(20)].map((_, i) => {
          const speed = 8 + (i % 5);
          const t = (frame / fps + i * 0.5) / speed;
          const y = 100 - ((t * 100) % 120);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i * 47) % 100}%`,
                top: `${y}%`,
                width: 3,
                height: 3,
                borderRadius: "50%",
                backgroundColor: i % 2 === 0 ? VIOLET : FUCHSIA,
                opacity: 0.7,
              }}
            />
          );
        })}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          padding: "50px 100px",
        }}
      >
        {/* Headline */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: "0.02em",
            lineHeight: 1,
            textShadow: `0 0 60px ${VIOLET}cc, 0 0 30px ${FUCHSIA}88, 0 4px 16px rgba(0,0,0,0.8)`,
            textAlign: "center",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {headlineChars}
        </div>

        {/* CTA */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 38,
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: CREAM,
            textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)",
            textAlign: "center",
          }}
        >
          Escanea y conviértete en tu personaje
        </div>

        {/* QR card */}
        <div
          style={{
            opacity: qrOpacity,
            transform: `scale(${qrScale * qrPulse})`,
            position: "relative",
            padding: 18,
            background: "#fff",
            borderRadius: 12,
            boxShadow: `0 0 80px ${VIOLET}88, 0 0 40px ${FUCHSIA}55, 0 8px 32px rgba(0,0,0,0.6)`,
            marginTop: 6,
          }}
        >
          <div
            style={{
              width: QR_SIZE,
              height: QR_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {qrUrl ? (
              <Img
                src={qrUrl}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", backgroundColor: "#ddd" }} />
            )}
          </div>
          {[
            { top: -3, left: -3, bt: 3, bl: 3 },
            { top: -3, right: -3, bt: 3, br: 3 },
            { bottom: -3, left: -3, bb: 3, bl: 3 },
            { bottom: -3, right: -3, bb: 3, br: 3 },
          ].map((s: any, i) => {
            const bs: React.CSSProperties = {};
            if (s.bt) bs.borderTop = `${s.bt}px solid ${VIOLET}`;
            if (s.bl) bs.borderLeft = `${s.bl}px solid ${VIOLET}`;
            if (s.br) bs.borderRight = `${s.br}px solid ${VIOLET}`;
            if (s.bb) bs.borderBottom = `${s.bb}px solid ${VIOLET}`;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 28,
                  height: 28,
                  top: s.top,
                  left: s.left,
                  right: s.right,
                  bottom: s.bottom,
                  ...bs,
                }}
              />
            );
          })}
        </div>

        {/* Footer CTA secundario */}
        <div
          style={{
            opacity: footerProgress,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.3em",
            color: "rgba(255,255,255,0.85)",
            textShadow: "0 2px 8px rgba(0,0,0,0.9)",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          Escanea con tu teléfono
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
