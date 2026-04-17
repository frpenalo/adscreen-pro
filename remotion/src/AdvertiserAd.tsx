import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const GOLD = "#C9A84C";

interface AdvertiserAdProps {
  photoUrl: string;
  businessName: string;
  tagline?: string;
  cta?: string;
}

export const AdvertiserAd: React.FC<AdvertiserAdProps> = ({
  photoUrl,
  businessName,
  tagline = "",
  cta = "Visítanos",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Ken Burns zoom: scale 1 → 1.08 over full duration ─────────────────────
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Accent line at frame 30: slides in from left ───────────────────────────
  const lineProgress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 60]);

  // ── Business name at frame 40: slides up with spring ──────────────────────
  const nameProgress = spring({
    frame: frame - 40,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const nameY = interpolate(nameProgress, [0, 1], [60, 0]);
  const nameOp = interpolate(nameProgress, [0, 1], [0, 1]);

  // ── Tagline at frame 75: fades up ─────────────────────────────────────────
  const taglineProgress = spring({
    frame: frame - 75,
    fps,
    config: { damping: 16, stiffness: 70 },
  });
  const taglineY = interpolate(taglineProgress, [0, 1], [30, 0]);
  const taglineOp = interpolate(taglineProgress, [0, 1], [0, 0.7]);

  // ── CTA at frame 110: scale spring ────────────────────────────────────────
  const ctaProgress = spring({
    frame: frame - 110,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.6, 1]);
  const ctaOp = interpolate(ctaProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>

      {/* ── Photo background with Ken Burns zoom ── */}
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
        {photoUrl ? (
          <Img
            src={photoUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", backgroundColor: "#222" }} />
        )}
      </AbsoluteFill>

      {/* ── Dark gradient overlay from bottom ── */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 40%, transparent 100%)",
        }}
      />

      {/* ── Content anchored to bottom-left ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          padding: "80px 96px",
          gap: 0,
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 3,
            backgroundColor: GOLD,
            marginBottom: 24,
          }}
        />

        {/* Business name */}
        <div
          style={{
            transform: `translateY(${nameY}px)`,
            opacity: nameOp,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: 72,
              fontWeight: 700,
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: 1.1,
              textShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          >
            {businessName}
          </span>
        </div>

        {/* Tagline */}
        {tagline ? (
          <div
            style={{
              transform: `translateY(${taglineY}px)`,
              opacity: taglineOp,
              marginBottom: 36,
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: 28,
                fontWeight: 300,
                fontFamily: "Arial, sans-serif",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {tagline}
            </span>
          </div>
        ) : (
          <div style={{ marginBottom: 36 }} />
        )}

        {/* CTA box */}
        <div
          style={{
            transform: `scale(${ctaScale})`,
            opacity: ctaOp,
            transformOrigin: "left center",
          }}
        >
          <div
            style={{
              border: `2px solid ${GOLD}`,
              padding: "14px 32px",
              display: "inline-block",
            }}
          >
            <span
              style={{
                color: GOLD,
                fontSize: 20,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 6,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {cta}
            </span>
          </div>
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
