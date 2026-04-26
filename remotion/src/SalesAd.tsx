import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── Paleta Gold Premium ───────────────────────────────────────────────────────
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#FFE08A";
const GOLD_DIM = "#8B6914";
const CREAM = "#F5F0E8";
const BG = "#080808";

// ── Partículas (posiciones determinísticas) ───────────────────────────────────
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  x: [8, 15, 25, 38, 52, 62, 72, 80, 88, 92, 18, 70][i],
  y: [15, 72, 35, 88, 12, 60, 30, 82, 45, 20, 55, 68][i],
  size: 2 + (i % 3),
  speed: 0.25 + (i % 5) * 0.08,
  phase: i * 0.63,
}));

interface SalesAdProps {
  headline?: string;
  subtitle?: string;
  // Optional third line below the subtitle. Default keeps the original
  // horizontal-TV wording. The vertical-for-social render passes an empty
  // string to hide it (the location is already in the subtitle there).
  tagline?: string;
  cta?: string;
  qrUrl?: string;
}

export const SalesAd: React.FC<SalesAdProps> = ({
  headline = "ANÚNCIATE",
  subtitle = "EN ESTA PANTALLA",
  tagline = "y en otras en toda la ciudad",
  cta = "Escanea el código",
  qrUrl = "",
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // ── Timing (frames @ 30fps) ───────────────────────────────────────────────
  const T_LINE      = 0;    // línea horizontal
  const T_LABEL     = 20;   // label AdScreenPro
  const T_HEADLINE  = 35;   // letras del headline
  const T_SUBTITLE  = 80;   // subtítulo
  const T_TAGLINE   = 105;  // tagline "y en otras..."
  const T_SEP       = 130;  // separador + shimmer
  const T_QR        = 160;  // QR + corners
  const T_PARTICLES = 220;  // partículas

  const CHAR_DELAY = 4; // frames entre letras (más rápido al tener más texto)

  // ── Línea superior ────────────────────────────────────────────────────────
  const lineProgress = spring({ frame: frame - T_LINE, fps, config: { damping: 20, stiffness: 60 } });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, width * 0.55]);

  // ── Label ─────────────────────────────────────────────────────────────────
  const labelOpacity = interpolate(frame, [T_LABEL, T_LABEL + 15], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Headline: tamaño adaptativo ───────────────────────────────────────────
  // Contar solo caracteres de texto (sin saltos de línea) para decidir tamaño
  const headlineText = headline.replace(/\n/g, " ");
  const totalChars = headlineText.length;

  const headlineFontSize = totalChars <= 10 ? 140
    : totalChars <= 16 ? 116
    : totalChars <= 24 ? 96
    : totalChars <= 32 ? 80
    : totalChars <= 42 ? 68
    : 58;

  const headlineLetterSpacing = totalChars > 20 ? 3 : 8;
  const headlineWordSpacing   = totalChars > 20 ? 18 : 28;

  // ── Subtítulo ─────────────────────────────────────────────────────────────
  const subProgress = spring({ frame: frame - T_SUBTITLE, fps, config: { damping: 14, stiffness: 80 } });
  const subY   = interpolate(subProgress, [0, 1], [50, 0]);
  const subOp  = interpolate(subProgress, [0, 1], [0, 1]);

  // ── Tagline ────────────────────────────────────────────────────────────────
  const tagOp = interpolate(frame, [T_TAGLINE, T_TAGLINE + 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const tagX = interpolate(frame, [T_TAGLINE, T_TAGLINE + 20], [20, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Separador ─────────────────────────────────────────────────────────────
  const sepProgress = spring({ frame: frame - T_SEP, fps, config: { damping: 18, stiffness: 90 } });
  const sepWidth = interpolate(sepProgress, [0, 1], [0, 280]);
  const shimmerX = interpolate(frame, [T_SEP + 5, T_SEP + 55], [-80, 360], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── QR ────────────────────────────────────────────────────────────────────
  const qrProgress = spring({ frame: frame - T_QR, fps, config: { damping: 16, stiffness: 85 } });
  const qrScale  = interpolate(qrProgress, [0, 1], [0.6, 1]);
  const qrOp     = interpolate(qrProgress, [0, 1], [0, 1]);
  const cornerSz = interpolate(qrProgress, [0, 1], [0, 28]);

  // ── Partículas ────────────────────────────────────────────────────────────
  const particleOp = interpolate(frame, [T_PARTICLES, T_PARTICLES + 25], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Renderizado de headline por palabras con soporte \n ───────────────────
  // Dividir por \n primero, luego por palabras dentro de cada línea.
  // Cada palabra es un flex-item; los saltos de línea son divs width:100%.
  // Esto evita el bug donde el span de espacio parte en líneas incorrectas.
  let globalCharIdx = 0;
  const headlineLines = headline.split("\n");
  const headlineElements: React.ReactNode[] = [];

  headlineLines.forEach((line, lineIdx) => {
    const words = line.split(" ").filter((w) => w.length > 0);
    words.forEach((word, wordIdx) => {
      // Render each char of the word with drop-in animation
      const charSpans = word.split("").map((char, ci) => {
        const gi = globalCharIdx++;
        const cf = frame - T_HEADLINE - gi * CHAR_DELAY;
        const cp = spring({ frame: cf, fps, config: { damping: 12, stiffness: 120 } });
        const cy = interpolate(cp, [0, 1], [-80, 0]);
        const co = interpolate(cp, [0, 1], [0, 1]);
        return (
          <span
            key={ci}
            style={{
              display: "inline-block",
              transform: `translateY(${cy}px)`,
              opacity: co,
              color: CREAM,
              fontSize: headlineFontSize,
              fontWeight: 700,
              letterSpacing: headlineLetterSpacing,
              fontFamily: "Georgia, 'Times New Roman', serif",
              textShadow: `0 0 60px ${GOLD}33`,
            }}
          >
            {char}
          </span>
        );
      });

      headlineElements.push(
        <span
          key={`line${lineIdx}-word${wordIdx}`}
          style={{ display: "inline-flex" }}
        >
          {charSpans}
        </span>
      );

      // Space between words (not after last word on a line)
      if (wordIdx < words.length - 1) {
        globalCharIdx++; // account for space in timing
        headlineElements.push(
          <span
            key={`sp-${lineIdx}-${wordIdx}`}
            style={{ display: "inline-block", width: headlineWordSpacing }}
          />
        );
      }
    });

    // Force line break after each line except the last
    if (lineIdx < headlineLines.length - 1) {
      headlineElements.push(
        <div key={`br-${lineIdx}`} style={{ width: "100%", height: 0 }} />
      );
    }
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: "hidden" }}>

      {/* ── Textura diagonal sutil ── */}
      <AbsoluteFill>
        <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.035 }}>
          <defs>
            <pattern id="diag" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <line x1="0" y1="50" x2="50" y2="0" stroke={GOLD} strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diag)" />
        </svg>
      </AbsoluteFill>

      {/* ── Glow radial central ── */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${GOLD_DIM}18 0%, transparent 70%)`,
      }} />

      {/* ── Partículas doradas ── */}
      <AbsoluteFill style={{ opacity: particleOp }}>
        {PARTICLES.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${p.x + Math.sin(frame * p.speed * 0.05 + p.phase) * 1.8}%`,
            top: `${p.y + Math.cos(frame * p.speed * 0.04 + p.phase) * 1.4}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: GOLD,
            opacity: 0.35 + Math.sin(frame * 0.06 + p.phase) * 0.25,
          }} />
        ))}
      </AbsoluteFill>

      {/* ── Línea superior ── */}
      <div style={{
        position: "absolute",
        top: 100,
        left: "50%",
        transform: "translateX(-50%)",
        width: lineWidth,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
      }} />

      {/* ── Contenido central ── */}
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        paddingLeft: 80,
        paddingRight: 80,
      }}>

        {/* Label */}
        <div style={{ opacity: labelOpacity, marginBottom: 36, letterSpacing: 7 }}>
          <span style={{
            color: GOLD,
            fontSize: 18,
            fontWeight: 400,
            textTransform: "uppercase",
            fontFamily: "Arial, sans-serif",
          }}>
            AdScreenPro
          </span>
        </div>

        {/* Headline por palabras con soporte \n */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
          maxWidth: "100%",
          textAlign: "center",
          rowGap: 8,
        }}>
          {headlineElements}
        </div>

        {/* Subtítulo */}
        <div style={{ transform: `translateY(${subY}px)`, opacity: subOp, marginBottom: 44 }}>
          <span style={{
            color: GOLD,
            fontSize: 34,
            fontWeight: 300,
            letterSpacing: 10,
            textTransform: "uppercase",
            fontFamily: "Arial, sans-serif",
          }}>
            {subtitle}
          </span>
        </div>

        {/* Tagline — hidden when prop is empty (vertical/social render) */}
        {tagline && (
          <div style={{ transform: `translateX(${tagX}px)`, opacity: tagOp, marginBottom: 44 }}>
            <span style={{
              color: CREAM,
              fontSize: 30,
              fontWeight: 300,
              letterSpacing: 4,
              fontFamily: "Arial, sans-serif",
              opacity: 0.65,
              fontStyle: "italic",
            }}>
              {tagline}
            </span>
          </div>
        )}

        {/* Separador con shimmer */}
        <div style={{ position: "relative", width: sepWidth, height: 1, marginBottom: 50, overflow: "visible" }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.7 }} />
          <div style={{
            position: "absolute",
            top: -5,
            left: shimmerX,
            width: 70,
            height: 10,
            background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}CC, transparent)`,
          }} />
        </div>

        {/* QR */}
        <div style={{ transform: `scale(${qrScale})`, opacity: qrOp, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>

          {/* Contenedor QR con corners */}
          <div style={{ position: "relative", padding: 6 }}>

            {/* QR image */}
            <div style={{
              backgroundColor: "#fff",
              padding: 14,
              width: 176,
              height: 176,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {qrUrl
                ? <Img src={qrUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <div style={{ width: "100%", height: "100%", backgroundColor: "#ddd" }} />
              }
            </div>

            {/* Corners targeting */}
            {[
              { top: 0,    left: 0,    borderTop:    `2px solid ${GOLD}`, borderLeft:  `2px solid ${GOLD}` },
              { top: 0,    right: 0,   borderTop:    `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` },
              { bottom: 0, left: 0,    borderBottom: `2px solid ${GOLD}`, borderLeft:  `2px solid ${GOLD}` },
              { bottom: 0, right: 0,   borderBottom: `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` },
            ].map((s, i) => (
              <div key={i} style={{ position: "absolute", width: cornerSz, height: cornerSz, ...s }} />
            ))}
          </div>

          {/* CTA */}
          <span style={{
            color: CREAM,
            fontSize: 26,
            fontWeight: 300,
            letterSpacing: 5,
            textTransform: "uppercase",
            fontFamily: "Arial, sans-serif",
            opacity: 0.9,
          }}>
            {cta}
          </span>
        </div>
      </AbsoluteFill>

      {/* ── Línea inferior ── */}
      <div style={{
        position: "absolute",
        bottom: 100,
        left: "50%",
        transform: "translateX(-50%)",
        width: lineWidth,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
      }} />

    </AbsoluteFill>
  );
};
