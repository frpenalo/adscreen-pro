import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface CinematicRevealProps {
  imageUrl: string;
  name: string | null;
  title: string | null;
  businessName: string;
  /** Called when the reveal sequence finishes — parent unmounts us */
  onComplete: () => void;
}

// Full-bleed 5-second reveal sequence that plays when a fresh selfie
// hits the rotation for the FIRST time. After this completes the
// parent unmounts the CinematicReveal and renders the normal selfie
// display for the remainder of its slot.
//
// Phase timing (total ~5s):
//   0.0-1.0s — black + "NEW LEGEND DETECTED" text-in
//   1.0-2.0s — "ANALYZING..." with fake scan metrics ticking up
//   2.0-3.2s — name reveal (big, dramatic)
//   3.2-4.2s — title reveal (with glow)
//   4.2-5.0s — final image scales in behind the name/title overlay
//
// All visual — no audio cues — because TV kiosks are muted.
export default function CinematicReveal({ imageUrl, name, title, businessName, onComplete }: CinematicRevealProps) {
  // Phase index drives which content is visible. Easier to reason
  // about than overlapping AnimatePresence per element.
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [fadeScore, setFadeScore] = useState(0);

  useEffect(() => {
    const timeline = [
      setTimeout(() => setPhase(1), 1000),   // → ANALYZING
      setTimeout(() => setPhase(2), 2000),   // → name
      setTimeout(() => setPhase(3), 3200),   // → title
      setTimeout(() => setPhase(4), 4200),   // → image scale-in
      setTimeout(() => onComplete(), 5000),  // → done
    ];
    return () => timeline.forEach(clearTimeout);
  }, [onComplete]);

  // Animate the fake "fade score" counting from 0 → 94 during phase 1
  useEffect(() => {
    if (phase !== 1) return;
    const target = 94;
    const start = Date.now();
    const duration = 900; // ms
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setFadeScore(Math.round(eased * target));
      if (p >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Background image — only visible in final phase */}
      <AnimatePresence>
        {phase === 4 && imageUrl && (
          <motion.div
            key="bg-image"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 0.95, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.5) 100%)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particle field — subtle dust drifting upward, persistent
          throughout the reveal. Pure CSS to keep it cheap. */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-violet-300"
            style={{
              width: 2,
              height: 2,
              left: `${(i * 47) % 100}%`,
              bottom: `-${i * 5}%`,
              animation: `cinematic-rise ${8 + (i % 5)}s linear infinite`,
              animationDelay: `-${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Phase 0: "NEW LEGEND DETECTED" */}
      <AnimatePresence>
        {phase === 0 && (
          <motion.div
            key="phase0"
            initial={{ opacity: 0, scale: 0.9, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="text-6xl mb-4" aria-hidden>👑</div>
              <div
                className="font-extrabold uppercase tracking-[0.4em] text-white"
                style={{
                  fontSize: "3vw",
                  textShadow: "0 0 40px rgba(168, 85, 247, 0.6)",
                }}
              >
                New Legend Detected
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 1: ANALYZING with scrolling metrics */}
      <AnimatePresence>
        {phase === 1 && (
          <motion.div
            key="phase1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center font-mono">
              <div
                className="font-bold uppercase tracking-[0.3em] text-violet-300 mb-8"
                style={{ fontSize: "2vw" }}
              >
                Analyzing...
              </div>
              <div className="space-y-3" style={{ fontSize: "1.8vw" }}>
                <div className="text-white/90">
                  Fade Score: <span className="text-emerald-400 font-bold tabular-nums">{fadeScore}/100</span>
                </div>
                <div className="text-white/90">
                  Class: <span className="text-amber-400 font-bold">ELITE</span>
                </div>
                <div className="text-white/90">
                  Style: <span className="text-fuchsia-400 font-bold">LEGENDARY</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2: NAME reveal */}
      <AnimatePresence>
        {phase === 2 && name && (
          <motion.div
            key="phase2"
            initial={{ opacity: 0, y: 40, filter: "blur(20px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(15px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div
              className="font-black uppercase tracking-tight text-white text-center"
              style={{
                fontSize: "10vw",
                lineHeight: 1,
                textShadow:
                  "0 0 60px rgba(168, 85, 247, 0.8), 0 0 30px rgba(236, 72, 153, 0.6)",
              }}
            >
              {name}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 3: TITLE reveal */}
      <AnimatePresence>
        {phase === 3 && title && (
          <motion.div
            key="phase3"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              {name && (
                <div
                  className="font-black uppercase tracking-tight text-white/70 mb-4"
                  style={{ fontSize: "5vw", lineHeight: 1 }}
                >
                  {name}
                </div>
              )}
              <div
                className="font-extrabold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-400"
                style={{
                  fontSize: "7vw",
                  lineHeight: 1.1,
                  filter: "drop-shadow(0 0 30px rgba(236, 72, 153, 0.5))",
                }}
              >
                {title}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 4: Final reveal with image visible behind, name + title overlay */}
      <AnimatePresence>
        {phase === 4 && (
          <motion.div
            key="phase4-overlay"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="absolute inset-x-0 bottom-12 text-center px-12"
          >
            {name && (
              <div
                className="font-black uppercase tracking-tight text-white mb-2"
                style={{
                  fontSize: "6vw",
                  lineHeight: 1,
                  textShadow: "0 4px 30px rgba(0,0,0,0.7)",
                }}
              >
                {name}
              </div>
            )}
            {title && (
              <div
                className="font-extrabold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-300"
                style={{
                  fontSize: "3.5vw",
                  lineHeight: 1.1,
                  filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.6))",
                }}
              >
                {title}
              </div>
            )}
            <div className="text-xs uppercase tracking-[0.3em] text-white/50 mt-4">
              {businessName} · Made with AdScreenPro
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particle keyframes injected once */}
      <style>{`
        @keyframes cinematic-rise {
          from { transform: translateY(0); opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.6; }
          to { transform: translateY(-120vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
