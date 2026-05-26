import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── SalesAd v2 Outro — solo texto + QR ──────────────────────────────────────
//
// Va DESPUÉS del Kling clip (sin overlay durante Kling). Pipeline tipo
// teaser: concat de Kling raw + este outro Remotion. Doble re-encoding
// del Kling se evita (Kling solo pasa por el ffmpeg concat una vez),
// resultado: playback fluido en Onn stick (vs stuttering del approach
// composite anterior).
//
// Duración: 144 frames @ 24fps = 6s. fps matchea Kling (24fps) para no
// reinterpolar en concat.
//
// Per-partner: qrUrl (data URL embedded) y businessName via inputProps.
//
// Timeline:
//   0-24f   (0-1s):    "ANÚNCIATE AQUÍ" letra por letra
//   18-36f  (0.75-1.5s): "y en otras pantallas alrededor de la ciudad"
//   30-60f  (1.25-2.5s): QR scale-in con glow
//   48-144f (2-6s):    Estable, QR escaneable (~4s ventana de scan)

const AMBER = "#fbbf24";
const FUCHSIA = "#ec4899";
const CREAM = "#fef3c7";

interface SalesAdOutroProps {
  qrUrl: string;
  businessName: string;
}

export const SalesAdOutro: React.FC<SalesAdOutroProps> = ({
  qrUrl,
  businessName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── H1: "ANÚNCIATE AQUÍ" letra por letra ─────────────────────────────────
  const T_H1 = 0;
  const headline = "ANÚNCIATE AQUÍ";
  const CHAR_DELAY = 2;

  // ── H2: "y en otras pantallas alrededor de la ciudad" ────────────────────
  const T_H2 = 18;
  const h2Progress = spring({
    frame: frame - T_H2,
    fps,
    config: { damping: 16, stiffness: 90 },
  });
  const h2Opacity = interpolate(h2Progress, [0, 1], [0, 1]);
  const h2Y = interpolate(h2Progress, [0, 1], [20, 0]);

  // ── QR (scale-in con glow) ────────────────────────────────────────────────
  const T_QR = 30;
  const qrProgress = spring({
    frame: frame - T_QR,
    fps,
    config: { damping: 16, stiffness: 85 },
  });
  const qrScale = interpolate(qrProgress, [0, 1], [0.7, 1]);
  const qrOpacity = interpolate(qrProgress, [0, 1], [0, 1]);
  // Pulse continuo sutil que invita a escanear
  const qrPulse = 1 + Math.sin((frame - T_QR) * 0.12) * 0.015;

  // ── Footer: business name + CTA ──────────────────────────────────────────
  const T_FOOTER = 48;
  const footerProgress = interpolate(
    frame,
    [T_FOOTER, T_FOOTER + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Glow ambient pulsante en el background ───────────────────────────────
  const ambientGlow = 0.25 + Math.sin(frame * 0.06) * 0.08;

  // ── Headline char-by-char ─────────────────────────────────────────────────
  const headlineChars = headline.split("").map((char, i) => {
    const cf = frame - T_H1 - i * CHAR_DELAY;
    const cp = spring({
      frame: cf,
      fps,
      config: { damping: 12, stiffness: 130 },
    });
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
          width: char === " " ? "0.4em" : undefined,
        }}
      >
        {char === " " ? " " : char}
      </span>
    );
  });

  const QR_SIZE = 320;

  return (
    // Background warm oscuro que matchea el final del Kling (warm glow).
    // Transición visual entre Kling end → outro start se ve coherente.
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, #3a1f0a 0%, #1a0a05 70%, #0a0500 100%)",
        overflow: "hidden",
      }}
    >
      {/* Pulse warm glow overlay */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${AMBER}${Math.round(
            ambientGlow * 255
          )
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />

      {/* Partículas warm ascendentes */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.35 }}>
        {[...Array(15)].map((_, i) => {
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
                width: 2,
                height: 2,
                borderRadius: "50%",
                backgroundColor: AMBER,
                opacity: 0.7,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* ── Layout: H1 top, QR center, footer bottom ─────────────────── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "50px 80px",
          gap: 30,
        }}
      >
        {/* H1: ANÚNCIATE AQUÍ */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 130,
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            lineHeight: 1,
            textShadow: `0 0 60px ${AMBER}aa, 0 0 30px ${FUCHSIA}88, 0 4px 16px rgba(0,0,0,0.8)`,
            textAlign: "center",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {headlineChars}
        </div>

        {/* H2: y en otras pantallas alrededor de la ciudad */}
        <div
          style={{
            opacity: h2Opacity,
            transform: `translateY(${h2Y}px)`,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "0.12em",
            color: CREAM,
            textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)",
            textAlign: "center",
            maxWidth: "70%",
          }}
        >
          y en otras pantallas alrededor de la ciudad
        </div>

        {/* QR centrado en card blanca con corners */}
        <div
          style={{
            opacity: qrOpacity,
            transform: `scale(${qrScale * qrPulse})`,
            position: "relative",
            padding: 20,
            background: "#fff",
            borderRadius: 12,
            boxShadow: `0 0 80px ${AMBER}77, 0 0 40px ${FUCHSIA}44, 0 8px 32px rgba(0,0,0,0.6)`,
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
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#ddd",
                }}
              />
            )}
          </div>
          {/* Corners targeting decorativos */}
          {[
            { top: -3, left: -3, borderTop: 3, borderLeft: 3 },
            { top: -3, right: -3, borderTop: 3, borderRight: 3 },
            { bottom: -3, left: -3, borderBottom: 3, borderLeft: 3 },
            { bottom: -3, right: -3, borderBottom: 3, borderRight: 3 },
          ].map((s, i) => {
            const { top, left, right, bottom, ...borders } = s as any;
            const borderStyle: React.CSSProperties = {};
            if (borders.borderTop)
              borderStyle.borderTop = `${borders.borderTop}px solid ${AMBER}`;
            if (borders.borderLeft)
              borderStyle.borderLeft = `${borders.borderLeft}px solid ${AMBER}`;
            if (borders.borderRight)
              borderStyle.borderRight = `${borders.borderRight}px solid ${AMBER}`;
            if (borders.borderBottom)
              borderStyle.borderBottom = `${borders.borderBottom}px solid ${AMBER}`;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 28,
                  height: 28,
                  top,
                  left,
                  right,
                  bottom,
                  ...borderStyle,
                }}
              />
            );
          })}
        </div>

        {/* Footer: business name + CTA */}
        <div
          style={{
            opacity: footerProgress,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: CREAM,
              textShadow:
                "0 2px 12px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            en {businessName}
          </div>
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.3em",
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 2px 8px rgba(0,0,0,0.9)",
              textTransform: "uppercase",
            }}
          >
            Escanea con tu teléfono
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
