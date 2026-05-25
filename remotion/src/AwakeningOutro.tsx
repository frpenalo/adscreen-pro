import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── Segmento D del teaser "The Awakening" ────────────────────────────────────
//
// Cierre del teaser cinemático. Va después de los 3 segmentos generados con
// Kling (A: ambient buildup, B: glow surge, C: character flashes). Convierte
// la atención que el teaser construyó en SCAN INMEDIATO del QR del partner —
// el QR aquí es REAL y apunta a /selfie/:screenId, igual que el del widget
// selfie-cta del player.
//
// Por eso este componente se renderiza UNA VEZ POR PARTNER (cada uno tiene
// su propio screenId → URL distinta → QR distinto). El build script
// (build-awakening-teaser.mjs) genera el PNG del QR, lo sube a Storage y
// nos pasa la URL pública como prop.
//
// Duración: 144 frames @ 24fps = 6s. Larga para que el QR esté visible y
// estable ~4s (suficiente para escanear). fps matchea Kling para no
// reinterpolar en concat.
//
// Timeline:
//   0-24f   (0-1s):    "WHO ARE YOU?" letra por letra
//   18-36f  (0.75-1.5s): QR scale-in con glow
//   36-60f  (1.5-2.5s): CTA "Scan to Unlock Your Character"
//   60-144f (2.5-6s):  Todo estable, QR escaneable (~3.5s ventana de scan)

const VIOLET = "#a78bfa";
const FUCHSIA = "#ec4899";
const AMBER = "#fbbf24";
const BG = "#000";

interface AwakeningOutroProps {
  /**
   * URL pública del QR PNG ya generado (mismo pattern que SalesAd:
   * el build script lo sube a Supabase Storage primero y nos pasa la
   * URL aquí). Si llega vacío/null, se renderiza un placeholder gris
   * — pero esto NUNCA debería pasar en producción.
   */
  qrUrl: string;
}

export const AwakeningOutro: React.FC<AwakeningOutroProps> = ({ qrUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Texto 1: "WHO ARE YOU?" letra por letra ──────────────────────────────
  const T_HEADLINE = 0;
  const headline = "WHO ARE YOU?";
  const CHAR_DELAY = 2; // frames entre letras

  // ── QR (scale-in con glow) ────────────────────────────────────────────────
  const T_QR = 18;
  const qrProgress = spring({
    frame: frame - T_QR,
    fps,
    config: { damping: 16, stiffness: 85 },
  });
  const qrScale = interpolate(qrProgress, [0, 1], [0.7, 1]);
  const qrOpacity = interpolate(qrProgress, [0, 1], [0, 1]);
  // Pulse continuo sutil después del scale-in — ayuda a "atraer el ojo"
  // y le da al QR un tono "alive" que invita a escanear.
  const qrPulse = 1 + Math.sin((frame - T_QR) * 0.12) * 0.015;

  // ── CTA "Scan to Unlock Your Character" ───────────────────────────────────
  const T_CTA = 36;
  const ctaProgress = spring({
    frame: frame - T_CTA,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const ctaY = interpolate(ctaProgress, [0, 1], [20, 0]);
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const arrowPulse = 1 + Math.sin((frame - T_CTA) * 0.22) * 0.15;

  // ── Glow ambient (sutil pulse continuo en el background) ──────────────────
  const ambientGlow = 0.18 + Math.sin(frame * 0.06) * 0.05;

  // ── Headline char-by-char ─────────────────────────────────────────────────
  const headlineChars = headline.split("").map((char, i) => {
    const cf = frame - T_HEADLINE - i * CHAR_DELAY;
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

  // QR_SIZE: ancho del QR (caja blanca interna). 320 px en un canvas 1920
  // — visible desde el otro lado de la barbería pero sin invadir el
  // headline arriba ni el CTA abajo.
  const QR_SIZE = 320;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: "hidden" }}>
      {/* ── Glow radial central ── */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${VIOLET}${Math.round(
            ambientGlow * 255
          )
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />

      {/* ── Partículas ascendentes (consistencia con CinematicReveal) ── */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.4 }}>
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

      {/* ── Layout: headline arriba, QR centro, CTA abajo ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 50,
          padding: "60px 120px",
        }}
      >
        {/* ── Headline ── */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 150,
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

        {/* ── QR REAL ── */}
        <div
          style={{
            transform: `scale(${qrScale * qrPulse})`,
            opacity: qrOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* Caja del QR con corners decorativos targeting */}
          <div
            style={{
              position: "relative",
              padding: 24,
              background: "#fff",
              boxShadow: `0 0 80px ${VIOLET}88, 0 0 40px ${FUCHSIA}55`,
              borderRadius: 8,
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
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
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

            {/* Corners decorativos tipo "targeting" alrededor del QR — */}
            {/* refuerzan visualmente que es algo que hay que escanear,  */}
            {/* y son el guiño cinemático que rompe la cuadrícula blanca */}
            {/* pura del QR. Color violeta para amarrarse con el resto.  */}
            {[
              { top: -4, left: -4, borderTop: 3, borderLeft: 3 },
              { top: -4, right: -4, borderTop: 3, borderRight: 3 },
              { bottom: -4, left: -4, borderBottom: 3, borderLeft: 3 },
              { bottom: -4, right: -4, borderBottom: 3, borderRight: 3 },
            ].map((s, i) => {
              const { top, left, right, bottom, ...borders } = s as any;
              const borderStyle: React.CSSProperties = {};
              if (borders.borderTop)
                borderStyle.borderTop = `${borders.borderTop}px solid ${VIOLET}`;
              if (borders.borderLeft)
                borderStyle.borderLeft = `${borders.borderLeft}px solid ${VIOLET}`;
              if (borders.borderRight)
                borderStyle.borderRight = `${borders.borderRight}px solid ${VIOLET}`;
              if (borders.borderBottom)
                borderStyle.borderBottom = `${borders.borderBottom}px solid ${VIOLET}`;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 32,
                    height: 32,
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
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "transparent",
              backgroundImage: `linear-gradient(90deg, ${VIOLET}, ${FUCHSIA}, ${AMBER})`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              filter: `drop-shadow(0 0 20px ${FUCHSIA}66)`,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <span style={{ transform: `scale(${arrowPulse})` }}>↑</span>
            Scan to Unlock Your Character
            <span style={{ transform: `scale(${arrowPulse})` }}>↑</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
