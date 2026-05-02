/**
 * AccentLine — short colored bar that springs to its target width.
 * Sits above the headline as a visual anchor. The bar's color, target
 * width, height, and start delay all come from the spec.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { LinePosition } from "../specs";

export interface AccentLineProps {
  color: string;
  width: number;
  height: number;
  delay: number;
  position: LinePosition;
  /**
   * Margin below the line, before the headline. Defaults to 20px to
   * match the legacy AdvertiserAd spacing.
   */
  marginBottom?: number;
}

const ALIGN_SELF: Record<LinePosition, "flex-start" | "center" | "flex-end"> = {
  left:   "flex-start",
  center: "center",
  right:  "flex-end",
};

export const AccentLine: React.FC<AccentLineProps> = ({
  color,
  width,
  height,
  delay,
  position,
  marginBottom = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const w = interpolate(progress, [0, 1], [0, width]);
  return (
    <div
      style={{
        width: w,
        height,
        backgroundColor: color,
        marginBottom,
        alignSelf: ALIGN_SELF[position],
      }}
    />
  );
};
