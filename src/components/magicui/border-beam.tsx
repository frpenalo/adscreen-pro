"use client";

import { motion, MotionStyle, Transition } from "motion/react";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  /**
   * The size of the beam in pixels.
   */
  size?: number;
  /**
   * Animation duration in seconds (lower = faster).
   */
  duration?: number;
  /**
   * Animation delay in seconds.
   */
  delay?: number;
  /**
   * Where the beam starts on the perimeter (0–100).
   */
  initialOffset?: number;
  /**
   * Tailwind/CSS classes for the beam container.
   */
  className?: string;
  /**
   * Inline style overrides on the beam element.
   */
  style?: React.CSSProperties;
  /**
   * Show beam on hover only.
   */
  reverse?: boolean;
  /**
   * Override colors of the gradient.
   */
  colorFrom?: string;
  colorTo?: string;
  /**
   * Optional motion transition override.
   */
  transition?: Transition;
  /**
   * Border width.
   */
  borderWidth?: number;
}

export function BorderBeam({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent] ![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={
        {
          "--border-width": borderWidth,
        } as MotionStyle
      }
    >
      <motion.div
        className={cn(
          "absolute aspect-square",
          "bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent",
          className,
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            ...style,
          } as MotionStyle
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}
