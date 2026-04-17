import { useEffect, useRef, useState } from "react";
import { Tv, Clock, Users, TrendingUp } from "lucide-react";

const SCREENS = 10;
const CLIENTS_PER_SCREEN = 300;
const MONTHLY_IMPRESSIONS = SCREENS * CLIENTS_PER_SCREEN;
const AVG_WAIT_MINUTES = 30;

function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

const stats = [
  {
    icon: Tv,
    label: "Pantallas activas",
    value: SCREENS,
    suffix: "",
    prefix: "",
    color: "#60a5fa",
    desc: "barberías en la red",
  },
  {
    icon: Clock,
    label: "Tiempo promedio de espera",
    value: AVG_WAIT_MINUTES,
    suffix: " min",
    prefix: "",
    color: "#a78bfa",
    desc: "tu anuncio siempre visible",
  },
  {
    icon: Users,
    label: "Clientes alcanzados",
    value: MONTHLY_IMPRESSIONS,
    suffix: "+",
    prefix: "",
    color: "#34d399",
    desc: "personas al mes",
  },
  {
    icon: TrendingUp,
    label: "Costo por persona",
    value: 2,
    suffix: "¢",
    prefix: "",
    color: "#fbbf24",
    desc: "por impresión directa",
  },
];

const ImpactSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const v0 = useCountUp(stats[0].value, 1400, visible);
  const v1 = useCountUp(stats[1].value, 1400, visible);
  const v2 = useCountUp(stats[2].value, 2000, visible);
  const v3 = useCountUp(stats[3].value, 1200, visible);
  const values = [v0, v1, v2, v3];

  return (
    <section
      ref={ref}
      style={{
        background: "#ffffff",
        position: "relative",
        overflow: "hidden",
        borderTop: "1px solid #e2e8f0",
        borderBottom: "1px solid #e2e8f0",
      }}
      className="py-12 md:py-16"
    >
      {/* Subtle dot pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.6,
        }}
      />

      <div className="container relative">
        {/* Header */}
        <div className="text-center mb-14">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.25)",
              borderRadius: "20px",
              padding: "4px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#2563eb",
              marginBottom: "16px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
            Alcance real, no estimado
          </div>
          <h2
            className="text-3xl font-bold md:text-4xl"
            style={{ color: "#0f172a" }}
          >
            Tu anuncio frente a{" "}
            <span style={{ color: "#60a5fa" }}>
              {MONTHLY_IMPRESSIONS.toLocaleString()}+ personas
            </span>{" "}
            al mes
          </h2>
          <p className="mt-3 text-lg" style={{ color: "#64748b" }}>
            Audiencia cautiva. Clientes que esperan, miran y recuerdan.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "28px 20px",
                textAlign: "center",
                transition: "border-color 0.3s, box-shadow 0.3s, transform 0.3s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${s.color}88`;
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${s.color}22`;
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "none";
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: `${s.color}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: `0 0 20px ${s.color}30`,
                }}
              >
                <s.icon style={{ width: "22px", height: "22px", color: s.color }} />
              </div>
              <div
                style={{
                  fontSize: "2.4rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.prefix}{values[i].toLocaleString()}{s.suffix}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155", marginTop: "8px" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom comparison */}
        <div
          style={{
            marginTop: "40px",
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.18)",
            borderRadius: "16px",
            padding: "20px 28px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#64748b", fontSize: "14px" }}>Comparado con:</span>
          {[
            { label: "Valla publicitaria", price: "$400+/mes", worse: true },
            { label: "Volantes", price: "$80/mes", worse: false },
            { label: "Redes sociales", price: "$150/mes", worse: true },
          ].map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#475569" }}>{c.label}</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#f87171" }}>{c.price}</span>
              {i < 2 && <span style={{ color: "#334155", margin: "0 4px" }}>·</span>}
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "8px" }}>
            <div style={{ width: "1px", height: "20px", background: "#cbd5e1" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#60a5fa" }}>AdScreenPro: $60/mes ✓</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
