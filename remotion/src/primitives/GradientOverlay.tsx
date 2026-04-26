/**
 * GradientOverlay — static CSS gradient layer between the photo and the
 * content. Each family declares its own gradient string, this primitive
 * just paints it.
 */

import React from "react";
import { AbsoluteFill } from "remotion";

export interface GradientOverlayProps {
  gradient: string;
}

export const GradientOverlay: React.FC<GradientOverlayProps> = ({ gradient }) => (
  <AbsoluteFill style={{ background: gradient }} />
);
