// ── NewsBackground — fondo animado tipo broadcast en vivo ───────────────────
//
// Comunica "global news / información en vivo" con CSS art puro:
//   1. Gradient base navy → black
//   2. Outline de mapa mundial muy faded al fondo (8% opacity, blurred)
//   3. Streams de luz vertical descendiendo (matrix-style sutil)
//   4. Data nodes pulsando en posiciones aleatorias
//   5. Vignette radial para profundidad
//
// Pure CSS, GPU-accelerated, cero dependencias.

const CSS_ANIMATIONS = `
  @keyframes news-stream {
    from { transform: translateY(-30vh); opacity: 0; }
    10% { opacity: 0.5; }
    90% { opacity: 0.5; }
    to { transform: translateY(130vh); opacity: 0; }
  }
  @keyframes news-node-pulse {
    0%, 100% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.5); opacity: 0.9; }
  }
  @keyframes news-map-breathe {
    0%, 100% { opacity: 0.06; }
    50% { opacity: 0.1; }
  }
  @keyframes news-glow-drift-left {
    0%, 100% { opacity: 0.4; transform: translateX(-10%); }
    50% { opacity: 0.7; transform: translateX(0%); }
  }
  @keyframes news-glow-drift-right {
    0%, 100% { opacity: 0.3; transform: translateX(10%); }
    50% { opacity: 0.6; transform: translateX(0%); }
  }
`;

// World map silhouette SVG (continentes simplificados). Tamaño grande,
// posicionado al fondo con baja opacity para no competir con el contenido.
function WorldMapSilhouette() {
  return (
    <svg
      className="absolute pointer-events-none"
      viewBox="0 0 1000 500"
      preserveAspectRatio="xMidYMid slice"
      style={{
        top: "50%",
        left: "50%",
        width: "120vw",
        height: "auto",
        transform: "translate(-50%, -50%)",
        filter: "blur(3px)",
        animation: "news-map-breathe 8s ease-in-out infinite",
      }}
    >
      {/* North America */}
      <path
        d="M 100 100 Q 120 80 180 90 L 230 110 L 260 140 Q 280 180 240 220 L 200 240 L 160 230 L 130 200 L 110 160 Z"
        fill="#fbbf24"
      />
      {/* South America */}
      <path
        d="M 230 260 L 280 270 L 290 320 Q 280 380 250 420 L 220 410 L 210 350 Z"
        fill="#fbbf24"
      />
      {/* Europe */}
      <path
        d="M 460 110 L 530 100 L 560 130 L 540 160 L 480 165 L 460 140 Z"
        fill="#fbbf24"
      />
      {/* Africa */}
      <path
        d="M 470 180 L 540 175 L 570 230 Q 560 310 510 380 L 470 370 L 450 300 L 460 220 Z"
        fill="#fbbf24"
      />
      {/* Asia */}
      <path
        d="M 560 100 L 700 90 L 800 120 L 830 170 L 780 200 L 700 210 L 620 180 L 580 140 Z"
        fill="#fbbf24"
      />
      {/* Australia */}
      <path
        d="M 770 320 L 850 310 L 870 350 L 830 370 L 780 360 Z"
        fill="#fbbf24"
      />
    </svg>
  );
}

function DataStreams() {
  // 12 streams verticales que descienden lento, posicionados aleatorios
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => {
        const left = (i * 83) % 100;
        const duration = 8 + (i % 5) * 2;
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: `${left}%`,
              top: 0,
              width: "1px",
              height: "25vh",
              background:
                i % 3 === 0
                  ? "linear-gradient(to bottom, transparent 0%, rgba(251,191,36,0.7) 50%, transparent 100%)"
                  : i % 3 === 1
                  ? "linear-gradient(to bottom, transparent 0%, rgba(167,139,250,0.6) 50%, transparent 100%)"
                  : "linear-gradient(to bottom, transparent 0%, rgba(94,234,212,0.6) 50%, transparent 100%)",
              animation: `news-stream ${duration}s linear infinite`,
              animationDelay: `${-(i * 1.2)}s`,
              boxShadow: "0 0 8px currentColor",
            }}
          />
        );
      })}
    </>
  );
}

function DataNodes() {
  // 25 puntos pulsando en posiciones determinísticas
  return (
    <>
      {Array.from({ length: 25 }).map((_, i) => {
        const left = (i * 41) % 100;
        const top = (i * 53) % 100;
        const size = 3 + (i % 3);
        const color =
          i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#a78bfa" : "#5eead4";
        return (
          <div
            key={i}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              boxShadow: `0 0 12px ${color}`,
              animation: `news-node-pulse ${3 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${-(i * 0.3)}s`,
            }}
          />
        );
      })}
    </>
  );
}

export function NewsBackground() {
  return (
    <>
      <style>{CSS_ANIMATIONS}</style>

      {/* Gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1a0a2e 0%, #0a0518 40%, #000000 100%)",
        }}
      />

      {/* World map silhouette (fondo, casi invisible) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <WorldMapSilhouette />
      </div>

      {/* Soft warm glow del lado izquierdo (amber) */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "20%",
          left: "-10%",
          width: "50vw",
          height: "70vh",
          background:
            "radial-gradient(ellipse, rgba(251,191,36,0.25) 0%, transparent 60%)",
          filter: "blur(40px)",
          animation: "news-glow-drift-left 12s ease-in-out infinite",
        }}
      />

      {/* Soft violet glow del lado derecho */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "30%",
          right: "-10%",
          width: "45vw",
          height: "60vh",
          background:
            "radial-gradient(ellipse, rgba(167,139,250,0.2) 0%, transparent 60%)",
          filter: "blur(50px)",
          animation: "news-glow-drift-right 14s ease-in-out infinite",
        }}
      />

      {/* Data streams (lluvia de luz vertical Matrix-style) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <DataStreams />
      </div>

      {/* Data nodes (puntos pulsando) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <DataNodes />
      </div>

      {/* Vignette para profundidad y mejor contraste del texto */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </>
  );
}
