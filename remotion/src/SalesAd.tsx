import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── Timing (frames @ 30fps) ───────────────────────────────────────────────
// 0-20   : background breathes in
// 20-50  : main headline slides up
// 50-80  : subtitle fades in
// 80-120 : QR + CTA zoom in
// 120-300: hold (loop-friendly pause)
// Total  : 300 frames = 10 seconds

interface SalesAdProps {
  headline?: string;
  subtitle?: string;
  cta?: string;
  qrUrl?: string; // URL to a QR image (png/svg hosted in Supabase)
  accentColor?: string;
}

export const SalesAd: React.FC<SalesAdProps> = ({
  headline = "¿Quieres que tus clientes\nte vean aquí?",
  subtitle = "Anúnciate en esta pantalla",
  cta = "Escanea y reserva tu espacio",
  qrUrl = "",
  accentColor = "#7C3AED",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Background pulse (subtle scale oscillation) ─────────────────────────
  const bgScale = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 0.5);

  // ── Headline slide-up ─────────────────────────────────────────────────────
  const headlineProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const headlineY = interpolate(headlineProgress, [0, 1], [80, 0]);
  const headlineOpacity = interpolate(headlineProgress, [0, 1], [0, 1]);

  // ── Subtitle fade ─────────────────────────────────────────────────────────
  const subtitleOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── QR + CTA zoom ─────────────────────────────────────────────────────────
  const qrProgress = spring({
    frame: frame - 80,
    fps,
    config: { damping: 16, stiffness: 90 },
  });
  const qrScale = interpolate(qrProgress, [0, 1], [0.4, 1]);
  const qrOpacity = interpolate(qrProgress, [0, 1], [0, 1]);

  // ── Accent bar width ──────────────────────────────────────────────────────
  const barWidth = interpolate(frame, [55, 85], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #24243e 100%)",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── Animated background orbs ── */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
        {/* top-left orb */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)`,
          }}
        />
        {/* bottom-right orb */}
        <div
          style={{
            position: "absolute",
            bottom: -150,
            right: -150,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: `radial-gradient(circle, #06b6d433 0%, transparent 70%)`,
          }}
        />
      </AbsoluteFill>

      {/* ── Grid pattern overlay ── */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Content ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          gap: 0,
        }}
      >
        {/* Top badge */}
        <div
          style={{
            opacity: subtitleOpacity,
            background: `${accentColor}22`,
            border: `1px solid ${accentColor}55`,
            borderRadius: 100,
            padding: "8px 24px",
            marginBottom: 40,
          }}
        >
          <span
            style={{
              color: accentColor,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            AdScreenPro
          </span>
        </div>

        {/* Main headline */}
        <div
          style={{
            transform: `translateY(${headlineY}px)`,
            opacity: headlineOpacity,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          <h1
            style={{
              color: "#ffffff",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              textShadow: "0 4px 30px rgba(0,0,0,0.4)",
              whiteSpace: "pre-line",
            }}
          >
            {headline}
          </h1>
        </div>

        {/* Accent bar */}
        <div
          style={{
            width: barWidth,
            height: 4,
            background: `linear-gradient(90deg, ${accentColor}, #06b6d4)`,
            borderRadius: 2,
            marginBottom: 24,
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 36,
            fontWeight: 400,
            margin: "0 0 60px",
            textAlign: "center",
            opacity: subtitleOpacity,
          }}
        >
          {subtitle}
        </p>

        {/* QR + CTA */}
        <div
          style={{
            transform: `scale(${qrScale})`,
            opacity: qrOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* QR container */}
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 16,
              boxShadow: `0 0 60px ${accentColor}44`,
              width: 200,
              height: 200,
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
              /* Placeholder QR pattern when no URL provided */
              <svg viewBox="0 0 100 100" width="168" height="168">
                {/* Finder patterns */}
                <rect x="10" y="10" width="30" height="30" fill="none" stroke="#000" strokeWidth="4"/>
                <rect x="15" y="15" width="20" height="20" fill="#000"/>
                <rect x="60" y="10" width="30" height="30" fill="none" stroke="#000" strokeWidth="4"/>
                <rect x="65" y="15" width="20" height="20" fill="#000"/>
                <rect x="10" y="60" width="30" height="30" fill="none" stroke="#000" strokeWidth="4"/>
                <rect x="15" y="65" width="20" height="20" fill="#000"/>
                {/* Timing pattern */}
                {[50,56,62,68,74,80,86].map((x, i) => i % 2 === 0 && <rect key={x} x={x} y="45" width="4" height="4" fill="#000"/>)}
                {/* Data modules */}
                {[
                  [50,60],[56,60],[68,60],[80,60],
                  [50,66],[62,66],[74,66],[86,66],
                  [56,72],[68,72],[80,72],
                  [50,78],[62,78],[74,78],[86,78],
                  [56,84],[68,84],[80,84],
                ].map(([x,y]) => (
                  <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" fill="#000"/>
                ))}
              </svg>
            )}
          </div>

          {/* CTA text */}
          <p
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: 28,
              fontWeight: 500,
              textAlign: "center",
              margin: 0,
            }}
          >
            {cta}
          </p>
        </div>
      </AbsoluteFill>

      {/* ── Bottom bar ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${accentColor}, #06b6d4, ${accentColor})`,
          opacity: subtitleOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
