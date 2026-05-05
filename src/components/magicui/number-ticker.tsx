"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  direction?: "up" | "down";
  delay?: number; // seconds
  decimalPlaces?: number;
  className?: string;
}

export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : 0);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (!isInView) return;
    const id = window.setTimeout(() => {
      motionValue.set(direction === "down" ? 0 : value);
    }, delay * 1000);
    return () => window.clearTimeout(id);
  }, [motionValue, isInView, delay, value, direction]);

  useEffect(() => {
    const unsub = springValue.on("change", (latest) => {
      if (!ref.current) return;
      ref.current.textContent = Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(Number(latest.toFixed(decimalPlaces)));
    });
    return () => unsub();
  }, [springValue, decimalPlaces]);

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums tracking-wider", className)}
    >
      0
    </span>
  );
}
