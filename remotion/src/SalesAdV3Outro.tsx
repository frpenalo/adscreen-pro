import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── SalesAd v3 Outro — QR per-partner + invitación ──────────────────────────
//
// Va DESPUÉS del clip de Gemini Omni (recorrido fachada→pantalla con los 3
// anuncios + la tarjeta "TU ANUNCIO PUEDE APARECER EN ESTA PANTALLA / y en
// otras alrededor de la ciudad", todo ya quemado en el clip por Omni). El
// build concatena clip Omni RAW + este outro — sin tocar el video de Omni
// (cero overlay encima → cero stuttering/PIPELINE_ERROR en el Onn stick).
// Mismo pipeline que el teaser y el v2 que corren fluidos.
//
// El outro NO repite el texto del clip; solo cierra con la llamada a la
// acción: invita a "ser parte de la nueva forma de hacer publicidad en la
// ciudad" + el QR per-partner (con su ref code → atribución de comisión).
//
// Duración: 180 frames @ 30fps = 6s. 30fps matchea AwakeningOutro (probado
// en la TV de Softmedia). El concat ffmpeg unifica todo a 30fps.
//
// Per-partner via inputProps: qrUrl (data URL embebido), businessName.
//
// Timeline:
//   0-14f   (0-0.5s):  "SÉ PARTE DE"
//   6-30f   (0.2-1s):  hero line palabra por palabra
//   24-48f  (0.8-1.6s): "en la ciudad"
//   42-84f  (1.4-2.8s): QR scale-in con glow
//   72-180f (2.4-6s):  estable, QR escaneable (~3.6s ventana de scan)

const AMBER = "#fbbf24";
const ORANGE = "#fb923c";
const CREAM = "#fef3c7";

interface SalesAdV3OutroProps {
  qrUrl: string;
  businessName: string;
}

export const SalesAdV3Outro: React.FC<SalesAdV3OutroProps> = ({
  qrUrl,
  businessName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Eyebrow "SÉ PARTE DE" ────────────────────────────────────────────────
  const eyebrowProgress = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Hero "LA NUEVA FORMA DE HACER PUBLICIDAD" palabra por palabra ─────────
  const T_HERO = 6;
  const WORD_DELAY = 3;
  const heroWords = ["LA", "NUEVA", "FORMA", "DE", "HACER", "PUBLICIDAD"];

  // ── "en la ciudad" ───────────────────────────────────────────────────────
  const T_H2 = 24;
  const h2Progress = spring({
    frame: frame - T_H2,
    fps,
    config: { damping: 16, stiffness: 90 },
  });
  const h2Opacity = interpolate(h2Progress, [0, 1], [0, 1]);
  const h2Y = interpolate(h2Progress, [0, 1], [20, 0]);

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

  // ── Footer ────────────────────────────────────────────────────────────────
  const T_FOOTER = 60;
  const footerProgress = interpolate(frame, [T_FOOTER, T_FOOTER + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Ambient glow pulsante ─────────────────────────────────────────────────
  const ambientGlow = 0.28 + Math.sin(frame * 0.06) * 0.08;

  const heroEls = heroWords.map((word, i) => {
    const wf = frame - T_HERO - i * WORD_DELAY;
    const wp = spring({ frame: wf, fps, config: { damping: 13, stiffness: 120 } });
    const wy = interpolate(wp, [0, 1], [44, 0]);
    const wo = interpolate(wp, [0, 1], [0, 1]);
    const wBlur = interpolate(wp, [0, 1], [12, 0]);
    const isKey = word === "NUEVA" || word === "PUBLICIDAD";
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          transform: `translateY(${wy}px)`,
          opacity: wo,
          filter: `blur(${wBlur}px)`,
          color: isKey ? AMBER : "#fff",
          marginRight: "0.26em",
        }}
      >
        {word}
      </span>
    );
  });

  const QR_SIZE = 300;

  return (
    // Warm dark gradient — bridge cálido desde el final del clip de Omni.
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, #3a1f0a 0%, #1a0a05 70%, #0a0500 100%)",
        overflow: "hidden",
      }}
    >
      {/* Pulse warm glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 42%, ${AMBER}${Math.round(
            ambientGlow * 255,
          )
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />

      {/* Partículas warm ascendentes */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.4 }}>
        {[...Array(18)].map((_, i) => {
          const speed = 7 + (i % 5);
          const t = (frame / fps + i * 0.5) / speed;
          const y = 100 - ((t * 100) % 120);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i * 39) % 100}%`,
                top: `${y}%`,
                width: 3,
                height: 3,
                borderRadius: "50%",
                backgroundColor: i % 2 === 0 ? AMBER : ORANGE,
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
          padding: "50px 80px",
          gap: 22,
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            opacity: eyebrowProgress,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "0.35em",
            color: CREAM,
            textTransform: "uppercase",
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          }}
        >
          Sé parte de
        </div>

        {/* Hero line */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 86,
            fontWeight: 900,
            letterSpacing: "0.01em",
            lineHeight: 1.05,
            textShadow: `0 0 60px ${AMBER}aa, 0 0 30px ${ORANGE}88, 0 4px 16px rgba(0,0,0,0.8)`,
            textAlign: "center",
            maxWidth: "88%",
          }}
        >
          {heroEls}
        </div>

        {/* en la ciudad */}
        <div
          style={{
            opacity: h2Opacity,
            transform: `translateY(${h2Y}px)`,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 40,
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: CREAM,
            textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)",
            textAlign: "center",
          }}
        >
          en la ciudad
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
            boxShadow: `0 0 80px ${AMBER}77, 0 0 40px ${ORANGE}44, 0 8px 32px rgba(0,0,0,0.6)`,
            marginTop: 8,
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
            if (s.bt) bs.borderTop = `${s.bt}px solid ${AMBER}`;
            if (s.bl) bs.borderLeft = `${s.bl}px solid ${AMBER}`;
            if (s.br) bs.borderRight = `${s.br}px solid ${AMBER}`;
            if (s.bb) bs.borderBottom = `${s.bb}px solid ${AMBER}`;
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

        {/* Footer: CTA + partner name */}
        <div style={{ opacity: footerProgress, textAlign: "center", marginTop: 4 }}>
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.9)",
              textShadow: "0 2px 8px rgba(0,0,0,0.9)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Escanea con tu teléfono
          </div>
          <div
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: AMBER,
              textShadow: "0 2px 12px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)",
              textTransform: "uppercase",
            }}
          >
            en {businessName}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
