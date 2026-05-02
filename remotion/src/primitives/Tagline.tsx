/**
 * Tagline — secondary text below the headline. Same entry animations
 * as Headline but type-on is intentionally NOT supported here (it
 * looks awkward on a tagline-length string) — the spec generator
 * already maps a headline's type-on to fade-up for the tagline.
 *
 * Lighter visual weight than Headline by default (different opacity
 * cap, lower font-weight from props), but driven entirely by spec.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EntryAnimation } from "../specs";

export interface TaglineProps {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textTransform: "none" | "uppercase";
  letterSpacing: number;
  color: string;
  entry: Exclude<EntryAnimation, "type-on">;
  delay: number;
  /**
   * Max opacity. Defaults to 0.88 — taglines read better slightly
   * receded so the headline stays dominant.
   */
  maxOpacity?: number;
  marginBottom?: number;
}

export const Tagline: React.FC<TaglineProps> = ({
  text,
  fontFamily,
  fontSize,
  fontWeight,
  fontStyle,
  textTransform,
  letterSpacing,
  color,
  entry,
  delay,
  maxOpacity = 0.88,
  marginBottom = 32,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 70 } });
  const opacity = interpolate(sp, [0, 1], [0, maxOpacity]);

  let translateY = 0;
  let translateX = 0;
  if (entry === "slide-up")        translateY = interpolate(sp, [0, 1], [22, 0]);
  if (entry === "slide-from-left") translateX = interpolate(sp, [0, 1], [-50, 0]);
  if (entry === "fade-up")         translateY = interpolate(sp, [0, 1], [18, 0]);

  return (
    <div
      style={{
        transform: `translateY(${translateY}px) translateX(${translateX}px)`,
        opacity,
        marginBottom,
        whiteSpace: "pre-line",
      }}
    >
      <span
        style={{
          color,
          fontSize,
          fontWeight,
          fontFamily,
          fontStyle,
          textTransform,
          letterSpacing,
          textShadow: "0 2px 16px rgba(0,0,0,0.7)",
        }}
      >
        {text}
      </span>
    </div>
  );
};
