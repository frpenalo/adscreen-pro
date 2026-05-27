// ── ClockBackground — fondo que cambia según hora del día ───────────────────
//
// 4 periodos visuales basados en la hora actual:
//   06:00 - 17:00   Día           → cielo azul + sol con rayos + nubes
//   17:00 - 19:00   Atardecer     → amber/violet gradient + sol bajo
//   19:00 - 21:00   Twilight      → deep violet + primeras estrellas
//   21:00 - 06:00   Noche         → dark + luna + estrellas + nebula
//
// Pure CSS, GPU-accelerated. Match real con hora actual.

type Period = "day" | "sunset" | "twilight" | "night";

function classifyHour(hour: number): Period {
  if (hour >= 6 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "sunset";
  if (hour >= 19 && hour < 21) return "twilight";
  return "night";
}

const GRADIENTS: Record<Period, string> = {
  day:
    "linear-gradient(180deg, #3b82f6 0%, #60a5fa 35%, #93c5fd 65%, #fed7aa 100%)",
  sunset:
    "linear-gradient(180deg, #7c2d92 0%, #c2410c 35%, #ea580c 65%, #fbbf24 100%)",
  twilight:
    "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 40%, #7c2d92 75%, #c2410c 100%)",
  night:
    "linear-gradient(180deg, #020617 0%, #0a0a1f 50%, #1a1530 100%)",
};

const CSS_ANIMATIONS = `
  @keyframes clock-sun-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes clock-cloud-drift {
    from { transform: translateX(-30vw); }
    to { transform: translateX(130vw); }
  }
  @keyframes clock-star-twinkle {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.3); }
  }
  @keyframes clock-moon-glow {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  @keyframes clock-nebula-breathe {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
`;

// ── DAY: sol con rayos + nubes blancas drifting ─────────────────────────────
function DayEffects() {
  return (
    <>
      {/* Sol con halo en top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "5%",
          right: "8%",
          width: "20vw",
          height: "20vw",
          background:
            "radial-gradient(circle, rgba(254,243,199,1) 0%, rgba(251,191,36,0.7) 25%, transparent 60%)",
          filter: "blur(2px)",
        }}
      />
      {/* Rayos rotando alrededor del sol */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-10%",
          right: "-5%",
          width: "50vw",
          height: "50vw",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(254,243,199,0.2) 5deg, transparent 18deg, transparent 36deg, rgba(254,243,199,0.18) 41deg, transparent 54deg, transparent 72deg, rgba(254,243,199,0.2) 77deg, transparent 90deg, transparent 108deg, rgba(254,243,199,0.18) 113deg, transparent 126deg, transparent 144deg, rgba(254,243,199,0.2) 149deg, transparent 162deg, transparent 360deg)",
          animation: "clock-sun-rotate 90s linear infinite",
          opacity: 0.55,
        }}
      />
      {/* Nubes blancas drifting */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            top: `${10 + i * 14}%`,
            width: `${22 + (i % 3) * 8}vw`,
            height: `${8 + (i % 2) * 3}vw`,
            background:
              "radial-gradient(ellipse 50% 100% at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 50%, transparent 75%)",
            animation: `clock-cloud-drift ${70 + (i * 15) % 30}s linear infinite`,
            animationDelay: `${-(i * 12)}s`,
            filter: "blur(6px)",
          }}
        />
      ))}
    </>
  );
}

// ── SUNSET: sol bajo amber + nubes warm + horizon glow ──────────────────────
function SunsetEffects() {
  return (
    <>
      {/* Sol grande bajo y warm en right side */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "10%",
          right: "10%",
          width: "26vw",
          height: "26vw",
          background:
            "radial-gradient(circle, rgba(254,215,170,1) 0%, rgba(251,146,60,0.85) 20%, rgba(234,88,12,0.5) 45%, transparent 70%)",
          filter: "blur(4px)",
        }}
      />
      {/* Halo gigante del sol */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "-20%",
          right: "-20%",
          width: "80vw",
          height: "80vw",
          background:
            "radial-gradient(circle, rgba(251,146,60,0.35) 0%, rgba(234,88,12,0.15) 30%, transparent 60%)",
          filter: "blur(40px)",
        }}
      />
      {/* Nubes warm-tinted drifting */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            top: `${15 + i * 18}%`,
            width: `${28 + (i % 3) * 10}vw`,
            height: `${10 + (i % 2) * 4}vw`,
            background:
              "radial-gradient(ellipse 50% 100% at center, rgba(254,215,170,0.7) 0%, rgba(251,146,60,0.4) 50%, transparent 75%)",
            animation: `clock-cloud-drift ${80 + (i * 18) % 25}s linear infinite`,
            animationDelay: `${-(i * 18)}s`,
            filter: "blur(8px)",
          }}
        />
      ))}
    </>
  );
}

// ── TWILIGHT: deep violet + primeras estrellas appearing ────────────────────
function TwilightEffects() {
  return (
    <>
      {/* Sol que se acaba de poner — leve glow en horizon */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "-30%",
          left: "20%",
          right: "20%",
          height: "60vh",
          background:
            "radial-gradient(ellipse at center, rgba(234,88,12,0.4) 0%, rgba(124,29,146,0.2) 40%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      {/* Primeras estrellas appearing (concentradas en upper third) */}
      {Array.from({ length: 30 }).map((_, i) => {
        const left = (i * 37) % 100;
        const top = (i * 23) % 45;
        const size = 1 + (i % 3);
        return (
          <div
            key={i}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: "#fff",
              boxShadow: "0 0 4px rgba(255,255,255,0.8)",
              animation: `clock-star-twinkle ${3 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${-(i * 0.4)}s`,
            }}
          />
        );
      })}
    </>
  );
}

// ── NIGHT: luna + estrellas + nebula ────────────────────────────────────────
function NightEffects() {
  return (
    <>
      {/* Crescent moon top-left */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          left: "8%",
          width: "12vw",
          height: "12vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 50%, #f8fafc 0%, #e0e7ff 40%, transparent 65%)",
          boxShadow: "0 0 60px rgba(224,231,255,0.5), 0 0 120px rgba(167,139,250,0.3)",
          animation: "clock-moon-glow 6s ease-in-out infinite",
        }}
      />
      {/* Nebula formation upper-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-5%",
          right: "-10%",
          width: "60vw",
          height: "50vh",
          background:
            "radial-gradient(ellipse, rgba(167,139,250,0.4) 0%, rgba(236,72,153,0.25) 30%, rgba(94,234,212,0.1) 55%, transparent 75%)",
          filter: "blur(35px)",
          animation: "clock-nebula-breathe 10s ease-in-out infinite",
        }}
      />
      {/* Subtle Milky Way diagonal */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-20%",
          left: "20%",
          width: "120vw",
          height: "30vh",
          background:
            "linear-gradient(15deg, transparent 30%, rgba(167,139,250,0.15) 45%, rgba(255,255,255,0.1) 50%, rgba(167,139,250,0.15) 55%, transparent 70%)",
          transform: "rotate(-15deg)",
          filter: "blur(30px)",
        }}
      />
      {/* Estrellas muchas y dispersas */}
      {Array.from({ length: 80 }).map((_, i) => {
        const left = (i * 31) % 100;
        const top = (i * 17) % 100;
        const size = 1 + (i % 3);
        const isBright = i % 7 === 0;
        return (
          <div
            key={i}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: "#fff",
              boxShadow: isBright
                ? "0 0 6px rgba(255,255,255,0.9), 0 0 12px rgba(255,255,255,0.5)"
                : "0 0 2px rgba(255,255,255,0.6)",
              animation: `clock-star-twinkle ${2 + (i % 5)}s ease-in-out infinite`,
              animationDelay: `${-(i * 0.15)}s`,
            }}
          />
        );
      })}
    </>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

interface ClockBackgroundProps {
  /** Hora actual (0-23). Si no se pasa, usa la del sistema. */
  hour?: number;
}

export function ClockBackground({ hour }: ClockBackgroundProps) {
  const h = hour ?? new Date().getHours();
  const period = classifyHour(h);

  return (
    <>
      <style>{CSS_ANIMATIONS}</style>
      {/* Background gradient por periodo */}
      <div
        className="absolute inset-0"
        style={{ background: GRADIENTS[period] }}
      />
      {/* Animaciones por periodo */}
      <div className="absolute inset-0 overflow-hidden">
        {period === "day" && <DayEffects />}
        {period === "sunset" && <SunsetEffects />}
        {period === "twilight" && <TwilightEffects />}
        {period === "night" && <NightEffects />}
      </div>
      {/* Vignette sutil para contraste del time display central */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            period === "day"
              ? "radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, transparent 50%)"
              : "radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </>
  );
}
