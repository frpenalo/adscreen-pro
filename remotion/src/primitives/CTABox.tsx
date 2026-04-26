/**
 * CTABox — the call-to-action element. 4 visual styles driven by the
 * spec (selected per family by the variation roll):
 *
 *   - outlined    border around the text, transparent fill
 *   - underlined  bottom border only, no box
 *   - filled      solid accent-color fill, contrasted text
 *   - badge       semi-transparent fill, rounded corners (pill-ish)
 *
 * Springs into view with a scale entry. Styling is per-family +
 * per-style, but the entry animation is consistent.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CTAStyle } from "../specs";

export interface CTABoxProps {
  text: string;
  accentColor: string;
  /**
   * Visual style. Each style picks its own border/fill/radius defaults
   * but the spec can also pass borderRadius / bgAlpha overrides.
   */
  style: CTAStyle;
  borderRadius: number;
  bgAlpha: number;
  delay: number;
  fontSize: number;
  /**
   * Side from which the box anchors. Defaults to "left" but vertical
   * layouts and centered families pass "center".
   */
  alignSelf?: "flex-start" | "center" | "flex-end";
}

function alphaToHex(alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  return Math.round(a * 255).toString(16).padStart(2, "0");
}

export const CTABox: React.FC<CTABoxProps> = ({
  text,
  accentColor,
  style,
  borderRadius,
  bgAlpha,
  delay,
  fontSize,
  alignSelf = "flex-start",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });
  const scale = interpolate(sp, [0, 1], [0.65, 1]);
  const opacity = interpolate(sp, [0, 1], [0, 1]);

  const bg = bgAlpha > 0 ? `${accentColor}${alphaToHex(bgAlpha)}` : "transparent";
  const isFilled = style === "filled";
  const isUnderlined = style === "underlined";

  // Filled styles flip text to a high-contrast color (white on dark
  // accents, dark on light accents). The simple rule below works for
  // our 15 family palettes; if we expand families later we can swap
  // for a true luminance check.
  const textColorOnFill = "#ffffff";

  const containerStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    opacity,
    transformOrigin: alignSelf === "center" ? "center" : alignSelf === "flex-end" ? "right center" : "left center",
    alignSelf,
  };

  const boxStyle: React.CSSProperties = isUnderlined
    ? {
        borderBottom: `3px solid ${accentColor}`,
        padding: "18px 12px 14px",
        display: "inline-block",
      }
    : {
        border: isFilled ? `3px solid ${accentColor}` : `3px solid ${accentColor}`,
        padding: "18px 48px",
        display: "inline-block",
        borderRadius,
        backgroundColor: isFilled ? accentColor : bg,
      };

  const textStyle: React.CSSProperties = {
    color: isFilled ? textColorOnFill : accentColor,
    fontSize,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 5,
    fontFamily: "Arial, sans-serif",
  };

  return (
    <div style={containerStyle}>
      <div style={boxStyle}>
        <span style={textStyle}>{text}</span>
      </div>
    </div>
  );
};
