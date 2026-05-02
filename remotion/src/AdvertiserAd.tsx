import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type AdStyle = "dark-gold" | "warm-amber" | "rose-elegant" | "bold-energy" | "clean-pro";

interface StyleConfig {
  accentColor: string;
  textColor: string;
  overlay: string;
  fontFamily: string;
  nameFontSize: number;
  zoomEnd: number;
  nameWeight: number;
  nameStyle: "normal" | "italic";
  nameTransform: "none" | "uppercase";
  nameLetterSpacing: number;
  ctaBorderRadius: number;
  ctaBgAlpha: number;
  textAlign: "left" | "center";
  lineHeight: number;
}

const STYLES: Record<AdStyle, StyleConfig> = {
  "dark-gold": {
    accentColor:      "#C9A84C",
    textColor:        "#ffffff",
    overlay:          "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
    fontFamily:       "Georgia, 'Times New Roman', serif",
    nameFontSize:     140,
    zoomEnd:          1.08,
    nameWeight:       700,
    nameStyle:        "normal",
    nameTransform:    "none",
    nameLetterSpacing: 0,
    ctaBorderRadius:  0,
    ctaBgAlpha:       0,
    textAlign:        "left",
    lineHeight:       5,
  },
  "warm-amber": {
    accentColor:      "#E8943A",
    textColor:        "#ffffff",
    overlay:          "linear-gradient(to top, rgba(50,18,0,0.90) 0%, rgba(80,30,0,0.35) 55%, transparent 100%)",
    fontFamily:       "Arial, Helvetica, sans-serif",
    nameFontSize:     132,
    zoomEnd:          1.0,
    nameWeight:       700,
    nameStyle:        "normal",
    nameTransform:    "none",
    nameLetterSpacing: 1,
    ctaBorderRadius:  4,
    ctaBgAlpha:       0,
    textAlign:        "center",
    lineHeight:       5,
  },
  "rose-elegant": {
    accentColor:      "#C9878F",
    textColor:        "#fff8f8",
    overlay:          "linear-gradient(to top, rgba(55,10,20,0.88) 0%, rgba(90,20,35,0.30) 55%, transparent 100%)",
    fontFamily:       "Georgia, serif",
    nameFontSize:     124,
    zoomEnd:          1.06,
    nameWeight:       400,
    nameStyle:        "italic",
    nameTransform:    "none",
    nameLetterSpacing: 3,
    ctaBorderRadius:  50,
    ctaBgAlpha:       0,
    textAlign:        "left",
    lineHeight:       4,
  },
  "bold-energy": {
    accentColor:      "#3B82F6",
    textColor:        "#ffffff",
    overlay:          "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,10,40,0.55) 50%, transparent 100%)",
    fontFamily:       "'Arial Black', Arial, sans-serif",
    nameFontSize:     148,
    zoomEnd:          1.12,
    nameWeight:       900,
    nameStyle:        "normal",
    nameTransform:    "uppercase",
    nameLetterSpacing: 5,
    ctaBorderRadius:  2,
    ctaBgAlpha:       0.18,
    textAlign:        "left",
    lineHeight:       5,
  },
  "clean-pro": {
    accentColor:      "#4A90D9",
    textColor:        "#ffffff",
    overlay:          "linear-gradient(to top, rgba(0,20,55,0.90) 0%, rgba(0,30,70,0.35) 55%, transparent 100%)",
    fontFamily:       "Arial, Helvetica, sans-serif",
    nameFontSize:     132,
    zoomEnd:          1.05,
    nameWeight:       700,
    nameStyle:        "normal",
    nameTransform:    "none",
    nameLetterSpacing: 0,
    ctaBorderRadius:  4,
    ctaBgAlpha:       0,
    textAlign:        "left",
    lineHeight:       5,
  },
};

interface AdvertiserAdProps {
  // Optional with defaults so Remotion can preview the composition with
  // no inputs (Remotion Studio loads compositions without props during
  // dev). The actual render scripts always pass these via renderMedia
  // inputProps, so production output is unchanged.
  photoUrl?: string;
  businessName?: string;
  tagline?: string;
  cta?: string;
  adStyle?: AdStyle;
}

export const AdvertiserAd: React.FC<AdvertiserAdProps> = ({
  photoUrl = "",
  businessName = "Mi Negocio",
  tagline = "",
  cta = "Visítanos",
  adStyle = "dark-gold",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cfg = STYLES[adStyle] ?? STYLES["dark-gold"];

  // ── Photo motion ─────────────────────────────────────────────────────────────
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // zoom (all styles)
  const zoom = interpolate(progress, [0, 1], [1, cfg.zoomEnd]);

  // warm-amber: horizontal pan instead of zoom
  const panX = adStyle === "warm-amber"
    ? interpolate(frame, [0, durationInFrames], [-2, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  // rose-elegant: slow upward drift
  const panY = adStyle === "rose-elegant"
    ? interpolate(frame, [0, durationInFrames], [1.5, -1.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  // bold-energy: black flash on entry
  const flashOp = adStyle === "bold-energy"
    ? interpolate(frame, [0, 6, 14], [1, 0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  // ── Accent line ──────────────────────────────────────────────────────────────
  const lineDelay = adStyle === "bold-energy" ? 15 : 25;
  const lineProgress = spring({ frame: frame - lineDelay, fps, config: { damping: 20, stiffness: 80 } });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, adStyle === "rose-elegant" ? 80 : 120]);

  // ── Business name ────────────────────────────────────────────────────────────
  const nameDelay = adStyle === "bold-energy" ? 22 : 38;
  const nameSp = spring({
    frame: frame - nameDelay,
    fps,
    config: { damping: adStyle === "bold-energy" ? 18 : 14, stiffness: adStyle === "bold-energy" ? 150 : 90 },
  });

  // bold-energy: slide from left | clean-pro: slide from left | others: slide up
  const nameY = adStyle === "clean-pro" || adStyle === "bold-energy"
    ? 0
    : interpolate(nameSp, [0, 1], [55, 0]);
  const nameX = adStyle === "clean-pro"
    ? interpolate(nameSp, [0, 1], [-70, 0])
    : adStyle === "bold-energy"
    ? interpolate(nameSp, [0, 1], [-90, 0])
    : 0;
  const nameOp = interpolate(nameSp, [0, 1], [0, 1]);

  // ── Tagline ──────────────────────────────────────────────────────────────────
  const tagDelay = adStyle === "bold-energy" ? 48 : 68;
  const tagSp = spring({ frame: frame - tagDelay, fps, config: { damping: 16, stiffness: 70 } });

  // rose-elegant: fades from above | others: fade from below
  const tagY = adStyle === "rose-elegant"
    ? interpolate(tagSp, [0, 1], [-18, 0])
    : interpolate(tagSp, [0, 1], [22, 0]);
  const tagOp = interpolate(tagSp, [0, 1], [0, 0.88]);

  // ── CTA ──────────────────────────────────────────────────────────────────────
  const ctaDelay = adStyle === "bold-energy" ? 68 : 98;
  const ctaSp = spring({ frame: frame - ctaDelay, fps, config: { damping: 12, stiffness: 100 } });
  const ctaScale = interpolate(ctaSp, [0, 1], [0.65, 1]);
  const ctaOp   = interpolate(ctaSp, [0, 1], [0, 1]);

  const isCentered = cfg.textAlign === "center";
  const photoTransform = `scale(${zoom}) translate(${panX}%, ${panY}%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>

      {/* ── Photo ── */}
      <AbsoluteFill style={{ transform: photoTransform, transformOrigin: "center center" }}>
        {photoUrl
          ? <Img src={photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a" }} />
        }
      </AbsoluteFill>

      {/* ── Overlay ── */}
      <AbsoluteFill style={{ background: cfg.overlay }} />

      {/* ── Flash (bold-energy) ── */}
      {adStyle === "bold-energy" && (
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: flashOp }} />
      )}

      {/* ── Content ── */}
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: isCentered ? "center" : "flex-start",
        padding: "80px 96px",
        textAlign: cfg.textAlign,
      }}>

        {/* Accent line */}
        <div style={{
          width: lineWidth,
          height: cfg.lineHeight,
          backgroundColor: cfg.accentColor,
          marginBottom: 20,
          alignSelf: isCentered ? "center" : "flex-start",
        }} />

        {/* Business name */}
        <div style={{
          transform: `translateY(${nameY}px) translateX(${nameX}px)`,
          opacity: nameOp,
          marginBottom: 16,
        }}>
          <span style={{
            color: cfg.textColor,
            fontSize: cfg.nameFontSize,
            fontWeight: cfg.nameWeight,
            fontFamily: cfg.fontFamily,
            fontStyle: cfg.nameStyle,
            textTransform: cfg.nameTransform,
            letterSpacing: cfg.nameLetterSpacing,
            lineHeight: 1.1,
            textShadow: "0 4px 24px rgba(0,0,0,0.7)",
          }}>
            {businessName}
          </span>
        </div>

        {/* Tagline */}
        {tagline ? (
          <div style={{ transform: `translateY(${tagY}px)`, opacity: tagOp, marginBottom: 32 }}>
            <span style={{
              color: cfg.textColor,
              fontSize: adStyle === "bold-energy" ? 58 : 64,
              fontWeight: adStyle === "bold-energy" ? 600 : 300,
              fontFamily: cfg.fontFamily,
              fontStyle: cfg.nameStyle,
              textTransform: adStyle === "bold-energy" ? "uppercase" : "none",
              letterSpacing: adStyle === "bold-energy" ? 3 : 0,
              textShadow: "0 2px 16px rgba(0,0,0,0.7)",
            }}>
              {tagline}
            </span>
          </div>
        ) : (
          <div style={{ marginBottom: 32 }} />
        )}

        {/* CTA */}
        <div style={{
          transform: `scale(${ctaScale})`,
          opacity: ctaOp,
          transformOrigin: isCentered ? "center" : "left center",
          alignSelf: isCentered ? "center" : "flex-start",
        }}>
          <div style={{
            border: `3px solid ${cfg.accentColor}`,
            padding: "18px 48px",
            display: "inline-block",
            borderRadius: cfg.ctaBorderRadius,
            backgroundColor: cfg.ctaBgAlpha > 0 ? `${cfg.accentColor}${Math.round(cfg.ctaBgAlpha * 255).toString(16).padStart(2, "0")}` : "transparent",
          }}>
            <span style={{
              color: cfg.accentColor,
              fontSize: 40,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 5,
              fontFamily: "Arial, sans-serif",
            }}>
              {cta}
            </span>
          </div>
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
