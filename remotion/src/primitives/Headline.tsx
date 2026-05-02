/**
 * Headline — primary text element. Supports 4 entry animations:
 *   - slide-up         (rises from below)
 *   - slide-from-left  (enters from off-screen left)
 *   - fade-up          (subtle rise + fade)
 *   - type-on          (reveals one char at a time)
 *
 * The font, size, weight, transform, and timing are all driven by the
 * spec — this primitive just orchestrates the chosen entry animation.
 *
 * Honors `\n` in the text by splitting into lines (avoids browser-line-
 * break ambiguity that would mess up type-on animation timing).
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EntryAnimation } from "../specs";

export interface HeadlineProps {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textTransform: "none" | "uppercase";
  letterSpacing: number;
  color: string;
  entry: EntryAnimation;
  delay: number;
  springConfig?: { damping: number; stiffness: number };
  /**
   * Frames between successive characters in type-on. Lower = faster.
   * Defaults to 3 frames @ 30fps = ~10ms per char.
   */
  charDelay?: number;
  /**
   * Margin below the headline, before the next element.
   */
  marginBottom?: number;
}

const DEFAULT_SPRING = { damping: 14, stiffness: 90 };

export const Headline: React.FC<HeadlineProps> = ({
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
  springConfig = DEFAULT_SPRING,
  charDelay = 3,
  marginBottom = 16,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Common spring used by spring-based entries.
  const sp = spring({ frame: frame - delay, fps, config: springConfig });
  const opacity = interpolate(sp, [0, 1], [0, 1]);

  // Per-entry transform.
  let translateY = 0;
  let translateX = 0;
  if (entry === "slide-up")          translateY = interpolate(sp, [0, 1], [55, 0]);
  if (entry === "slide-from-left")   translateX = interpolate(sp, [0, 1], [-90, 0]);
  if (entry === "fade-up")           translateY = interpolate(sp, [0, 1], [22, 0]);
  // type-on uses per-char reveal, no translate

  const baseSpanStyle: React.CSSProperties = {
    color,
    fontSize,
    fontWeight,
    fontFamily,
    fontStyle,
    textTransform,
    letterSpacing,
    lineHeight: 1.1,
    textShadow: "0 4px 24px rgba(0,0,0,0.7)",
  };

  // ── type-on path ───────────────────────────────────────────────────────────
  if (entry === "type-on") {
    const lines = text.split("\n");
    let charIdx = 0;
    return (
      <div style={{ marginBottom }}>
        {lines.map((line, lineIdx) => (
          <div key={lineIdx} style={{ display: "block" }}>
            {line.split("").map((ch, i) => {
              const charFrame = frame - delay - charIdx * charDelay;
              const charOpacity = charFrame >= 0 ? 1 : 0;
              charIdx += 1;
              return (
                <span key={i} style={{ ...baseSpanStyle, opacity: charOpacity }}>
                  {ch === " " ? " " : ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ── spring-based entries ───────────────────────────────────────────────────
  return (
    <div
      style={{
        transform: `translateY(${translateY}px) translateX(${translateX}px)`,
        opacity,
        marginBottom,
        whiteSpace: "pre-line",
      }}
    >
      <span style={baseSpanStyle}>{text}</span>
    </div>
  );
};
