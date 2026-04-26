/**
 * PhotoBackground — full-frame photo with optional motion (zoom / pan).
 *
 * Mirrors the photo behavior that lives inline in AdvertiserAd.tsx:
 * a scale + translate transform animated across the whole composition
 * duration. The exact motion is selected by the spec generator and
 * passed in as the `motion` prop, so this primitive stays generic.
 */

import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { PhotoMotion } from "../specs";

export interface PhotoBackgroundProps {
  url: string;
  motion: PhotoMotion;
  zoomTo: number;
  /**
   * Pan range as a percentage of the photo. Default ±2% — gentle motion
   * that's noticeable on a 1920x1080 TV but doesn't make the still
   * subject feel seasick on social.
   */
  panRange?: number;
}

export const PhotoBackground: React.FC<PhotoBackgroundProps> = ({
  url,
  motion,
  zoomTo,
  panRange = 2,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const zoom = motion === "none" ? 1 : interpolate(progress, [0, 1], [1, zoomTo]);
  const panX = motion === "pan-x"
    ? interpolate(frame, [0, durationInFrames], [-panRange, panRange], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const panY = motion === "pan-y"
    ? interpolate(frame, [0, durationInFrames], [panRange * 0.75, -panRange * 0.75], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const transform = `scale(${zoom}) translate(${panX}%, ${panY}%)`;

  return (
    <AbsoluteFill style={{ transform, transformOrigin: "center center" }}>
      {url ? (
        <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a" }} />
      )}
    </AbsoluteFill>
  );
};
