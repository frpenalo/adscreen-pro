// ── JokeBackground — fondo cálido playful con confetti + blobs ──────────────
//
// Vibe: humor/calidez/diversión SIN ser cartoonish. Compuesto por:
//   1. Gradient cálido amber/coral/peach
//   2. Large floating blobs (pastel pink/yellow/mint) drifting slow
//   3. Confetti pieces cayendo con rotación
//   4. Sparkles dispersos pulsando
//
// Pure CSS, GPU-accelerated, cero dependencias.

const CSS_ANIMATIONS = `
  @keyframes joke-blob-drift {
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(8vw, -5vh) scale(1.1); }
    66% { transform: translate(-5vw, 8vh) scale(0.9); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes joke-confetti-fall {
    0% {
      transform: translate3d(0, -20vh, 0) rotate(0deg);
      opacity: 0;
    }
    10% { opacity: 1; }
    90% { opacity: 0.8; }
    100% {
      transform: translate3d(-8vw, 120vh, 0) rotate(720deg);
      opacity: 0;
    }
  }
  @keyframes joke-sparkle-pulse {
    0%, 100% { transform: scale(0.6); opacity: 0.3; }
    50% { transform: scale(1.2); opacity: 0.9; }
  }
`;

// Blobs grandes "lava lamp style" drifting suave
function FloatingBlobs() {
  const blobs = [
    { left: "5%", top: "10%", color: "rgba(251,207,232,0.55)", size: "30vw", delay: 0 },     // pink
    { left: "65%", top: "5%", color: "rgba(254,243,199,0.5)", size: "28vw", delay: -8 },    // yellow
    { left: "70%", top: "55%", color: "rgba(187,247,208,0.45)", size: "32vw", delay: -15 }, // mint
    { left: "10%", top: "55%", color: "rgba(221,214,254,0.5)", size: "26vw", delay: -22 },  // lavender
    { left: "40%", top: "30%", color: "rgba(254,215,170,0.4)", size: "30vw", delay: -30 },  // peach
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            backgroundColor: b.color,
            filter: "blur(60px)",
            animation: `joke-blob-drift ${24 + i * 4}s ease-in-out infinite`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </>
  );
}

// Confetti pieces — pequeños papelitos cayendo con rotación
function ConfettiPieces() {
  const colors = [
    "#ec4899", // pink
    "#fbbf24", // amber
    "#a78bfa", // violet
    "#34d399", // emerald
    "#60a5fa", // blue
    "#f87171", // red
  ];
  return (
    <>
      {Array.from({ length: 40 }).map((_, i) => {
        const left = (i * 53) % 100;
        const color = colors[i % colors.length];
        const isCircle = i % 3 === 0;
        const isRect = i % 3 === 1;
        const width = 6 + (i % 4) * 2;
        const height = isCircle ? width : isRect ? width * 1.8 : width * 0.5;
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: `${left}%`,
              top: "-10vh",
              width: `${width}px`,
              height: `${height}px`,
              backgroundColor: color,
              borderRadius: isCircle ? "50%" : "2px",
              animation: `joke-confetti-fall ${8 + (i % 5) * 2}s linear infinite`,
              animationDelay: `${-(i * 0.6)}s`,
              opacity: 0.85,
              boxShadow: `0 0 6px ${color}55`,
            }}
          />
        );
      })}
    </>
  );
}

// Sparkles — puntitos brillantes pulsando
function Sparkles() {
  return (
    <>
      {Array.from({ length: 20 }).map((_, i) => {
        const left = (i * 71) % 100;
        const top = (i * 43) % 100;
        return (
          <div
            key={i}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: "4px",
              height: "4px",
              backgroundColor: "#fff",
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
              animation: `joke-sparkle-pulse ${2 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${-(i * 0.3)}s`,
            }}
          />
        );
      })}
    </>
  );
}

export function JokeBackground() {
  return (
    <>
      <style>{CSS_ANIMATIONS}</style>

      {/* Gradient base cálido */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #fb923c 0%, #f472b6 40%, #a78bfa 80%, #6366f1 100%)",
        }}
      />

      {/* Floating blobs grandes (lava lamp) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingBlobs />
      </div>

      {/* Confetti cayendo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ConfettiPieces />
      </div>

      {/* Sparkles dispersos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Sparkles />
      </div>

      {/* Vignette para contraste del card central */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </>
  );
}
