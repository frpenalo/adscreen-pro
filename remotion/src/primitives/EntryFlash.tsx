/**
 * EntryFlash — opens with a colored full-screen flash that fades out
 * over `duration` frames. Used by high-energy families (bold-energy,
 * urban-graffiti, glow-neon) to give the ad a punchy start.
 *
 * Renders nothing once the flash has finished.
 */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export interface EntryFlashProps {
  color: string;
  duration: number;
}

export const EntryFlash: React.FC<EntryFlashProps> = ({ color, duration }) => {
  const frame = useCurrentFrame();
  if (frame >= duration) return null;
  // 1 → 0.4 (fast) → 0 (linger) — punchier than a linear fade.
  const opacity = interpolate(
    frame,
    [0, duration * 0.45, duration],
    [1, 0.4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <AbsoluteFill style={{ backgroundColor: color, opacity }} />;
};
