// ── WeatherBackground — fondo dinámico animado por condición climática ───────
//
// Reemplaza el gradient azul plano del WeatherWidget por:
//   1. Gradient base que cambia según el WMO code de Open-Meteo
//   2. Layer de animaciones CSS encima (gotas de lluvia, copos de nieve,
//      rayos de sol rotando, nubes drifting, relámpagos, etc.)
//
// Pure CSS, GPU-accelerated (transform + opacity only). Cero dependencias
// nuevas. Performance friendly para el Onn stick.

type WeatherType =
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "heavy-rain"
  | "snow"
  | "storm";

function classify(code: number): WeatherType {
  if (code === 0 || code === 1) return "sunny";
  if (code === 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code === 51 || code === 53) return "rain";          // drizzle
  if (code === 61 || code === 63) return "rain";          // light/moderate rain
  if (code === 65 || code === 80) return "heavy-rain";    // heavy / showers
  if (code === 71 || code === 73) return "snow";
  if (code === 95) return "storm";
  return "cloudy"; // fallback for unknown codes
}

// ── Gradients por tipo ──────────────────────────────────────────────────────
const GRADIENTS: Record<WeatherType, string> = {
  "sunny":
    "linear-gradient(135deg, #f59e0b 0%, #ea580c 45%, #7c2d12 100%)",
  "partly-cloudy":
    "linear-gradient(135deg, #fbbf24 0%, #c2410c 50%, #1e1b4b 100%)",
  "cloudy":
    "linear-gradient(135deg, #475569 0%, #334155 50%, #1e293b 100%)",
  "fog":
    "linear-gradient(135deg, #94a3b8 0%, #64748b 50%, #475569 100%)",
  "rain":
    "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)",
  "heavy-rain":
    "linear-gradient(135deg, #0f172a 0%, #020617 50%, #000000 100%)",
  "snow":
    "linear-gradient(135deg, #dbeafe 0%, #94a3b8 50%, #475569 100%)",
  "storm":
    "linear-gradient(135deg, #1e1b4b 0%, #0a0a0a 50%, #000000 100%)",
};

// ── CSS animations injected once ────────────────────────────────────────────
const CSS_ANIMATIONS = `
  @keyframes weather-sun-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes weather-particle-rise {
    0% { transform: translateY(100vh) scale(1); opacity: 0; }
    15% { opacity: 0.7; }
    85% { opacity: 0.4; }
    100% { transform: translateY(-10vh) scale(0.5); opacity: 0; }
  }
  @keyframes weather-cloud-drift {
    from { transform: translateX(-30vw); }
    to { transform: translateX(130vw); }
  }
  @keyframes weather-rain-fall {
    from { transform: translate3d(0, -10vh, 0); opacity: 0; }
    8% { opacity: 0.7; }
    92% { opacity: 0.7; }
    to { transform: translate3d(-12vw, 110vh, 0); opacity: 0; }
  }
  @keyframes weather-snow-fall {
    from { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
    8% { opacity: 0.9; }
    92% { opacity: 0.7; }
    to { transform: translate3d(8vw, 110vh, 0) rotate(360deg); opacity: 0; }
  }
  @keyframes weather-lightning-flash {
    0%, 92%, 100% { opacity: 0; }
    93%, 95% { opacity: 0.85; }
    94% { opacity: 0; }
  }
  @keyframes weather-fog-drift {
    from { transform: translateX(-20vw); opacity: 0.3; }
    50% { opacity: 0.5; }
    to { transform: translateX(20vw); opacity: 0.3; }
  }
  @keyframes weather-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.9; }
  }
`;

// ── Subcomponentes por tipo ─────────────────────────────────────────────────

function SunnyEffects() {
  // Sun ball + rays rotando + partículas doradas subiendo
  return (
    <>
      {/* Sun disc with rays in top-left */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-15vw",
          left: "-15vw",
          width: "60vw",
          height: "60vw",
          background:
            "radial-gradient(circle, rgba(254,243,199,0.7) 0%, rgba(251,191,36,0.4) 20%, transparent 50%)",
          animation: "weather-pulse 6s ease-in-out infinite",
        }}
      />
      {/* Rotating sun rays */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-30vw",
          left: "-30vw",
          width: "90vw",
          height: "90vw",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(254,243,199,0.18) 5deg, transparent 15deg, transparent 30deg, rgba(254,243,199,0.18) 35deg, transparent 45deg, transparent 60deg, rgba(254,243,199,0.18) 65deg, transparent 75deg, transparent 90deg, rgba(254,243,199,0.18) 95deg, transparent 105deg, transparent 120deg, rgba(254,243,199,0.18) 125deg, transparent 135deg, transparent 360deg)",
          animation: "weather-sun-rotate 80s linear infinite",
          opacity: 0.6,
        }}
      />
      {/* Golden particles floating up */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${(i * 47) % 100}%`,
            width: `${4 + (i % 3) * 2}px`,
            height: `${4 + (i % 3) * 2}px`,
            backgroundColor: "rgba(254,243,199,0.7)",
            boxShadow: "0 0 8px rgba(254,243,199,0.8)",
            animation: `weather-particle-rise ${12 + (i % 5) * 2}s linear infinite`,
            animationDelay: `${-i * 0.8}s`,
          }}
        />
      ))}
    </>
  );
}

function PartlyCloudyEffects() {
  // Sun rays más sutiles + nubes drifting
  return (
    <>
      <SunnyEffects />
      <CloudOverlay opacity={0.35} count={4} />
    </>
  );
}

function CloudOverlay({ opacity = 0.5, count = 6 }: { opacity?: number; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            top: `${5 + (i * 17) % 70}%`,
            width: `${25 + (i % 3) * 10}vw`,
            height: `${10 + (i % 2) * 4}vw`,
            background: `radial-gradient(ellipse 50% 100% at center, rgba(241,245,249,${opacity}) 0%, transparent 70%)`,
            animation: `weather-cloud-drift ${60 + (i * 12) % 40}s linear infinite`,
            animationDelay: `${-(i * 10)}s`,
            filter: "blur(8px)",
          }}
        />
      ))}
    </>
  );
}

function CloudyEffects() {
  return <CloudOverlay opacity={0.55} count={7} />;
}

function FogEffects() {
  // Capas de niebla drifting
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute pointer-events-none inset-x-0"
          style={{
            top: `${20 + i * 25}%`,
            height: "30vh",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(248,250,252,0.5) 30%, rgba(248,250,252,0.7) 50%, rgba(248,250,252,0.5) 70%, transparent 100%)",
            animation: `weather-fog-drift ${20 + i * 8}s ease-in-out infinite alternate`,
            animationDelay: `${-i * 4}s`,
            filter: "blur(16px)",
          }}
        />
      ))}
    </>
  );
}

function RainEffects({ heavy = false }: { heavy?: boolean }) {
  const dropCount = heavy ? 100 : 65;
  return (
    <>
      {/* Capas de nubes oscuras encima */}
      <CloudOverlay opacity={0.4} count={5} />
      {/* Gotas */}
      {Array.from({ length: dropCount }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: `${(i * 137) % 100}%`,
            width: "2px",
            height: `${heavy ? 22 : 16}px`,
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(186,230,253,0.7) 50%, rgba(186,230,253,0.95) 100%)",
            animation: `weather-rain-fall ${heavy ? 0.6 : 0.85}s linear infinite`,
            animationDelay: `${-(i * 0.03)}s`,
          }}
        />
      ))}
    </>
  );
}

function SnowEffects() {
  return (
    <>
      <CloudOverlay opacity={0.5} count={4} />
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${(i * 71) % 100}%`,
            width: `${5 + (i % 4) * 2}px`,
            height: `${5 + (i % 4) * 2}px`,
            backgroundColor: "rgba(248,250,252,0.95)",
            boxShadow: "0 0 4px rgba(248,250,252,0.6)",
            animation: `weather-snow-fall ${6 + (i % 5) * 2}s linear infinite`,
            animationDelay: `${-(i * 0.2)}s`,
          }}
        />
      ))}
    </>
  );
}

function StormEffects() {
  return (
    <>
      <RainEffects heavy />
      {/* Lightning flash overlay (siempre montado, dispara cada ~10s via keyframes) */}
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(196,181,253,0.6) 40%, transparent 100%)",
          animation: "weather-lightning-flash 11s ease-in-out infinite",
        }}
      />
    </>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

interface WeatherBackgroundProps {
  /** WMO weather code from open-meteo. */
  code: number | null | undefined;
}

export function WeatherBackground({ code }: WeatherBackgroundProps) {
  const type = code != null ? classify(code) : "cloudy";

  return (
    <>
      <style>{CSS_ANIMATIONS}</style>
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{ background: GRADIENTS[type] }}
      />
      {/* Animation layer */}
      <div className="absolute inset-0 overflow-hidden">
        {type === "sunny" && <SunnyEffects />}
        {type === "partly-cloudy" && <PartlyCloudyEffects />}
        {type === "cloudy" && <CloudyEffects />}
        {type === "fog" && <FogEffects />}
        {type === "rain" && <RainEffects />}
        {type === "heavy-rain" && <RainEffects heavy />}
        {type === "snow" && <SnowEffects />}
        {type === "storm" && <StormEffects />}
      </div>
      {/* Subtle vignette para mejor contraste del card central */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </>
  );
}
