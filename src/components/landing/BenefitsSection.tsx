import { Users, RefreshCw, Smartphone, DollarSign } from "lucide-react";

const benefits = [
  {
    icon: Users,
    title: "Audiencia cautiva frente a tu anuncio",
    desc: "Los clientes en la silla de barbería esperan entre 20 y 40 minutos. Tu marca tiene su atención completa, sin competencia.",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
  },
  {
    icon: RefreshCw,
    title: "Rotación dinámica en múltiples locales",
    desc: "Tu anuncio rota automáticamente en todas las barberías de la red. Más alcance, más impacto, sin hacer nada extra.",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
  },
  {
    icon: Smartphone,
    title: "Publica desde tu celular en minutos",
    desc: "Toma una foto de tu producto, agrégale texto y logo, y en menos de 24 horas está en pantalla. Sin agencias, sin complicaciones.",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
  },
  {
    icon: DollarSign,
    title: "Precio accesible, impacto real",
    desc: "Menos que repartir volantes al mes. Con la diferencia de que tu anuncio llega a clientes que ya están sentados y disponibles.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
  },
];

const BenefitsSection = () => {
  return (
    <section id="benefits" className="py-12 md:py-16" style={{ background: "#ffffff" }}>
      <div className="container">
        <div className="text-center">
          <h2 className="text-3xl font-bold md:text-4xl" style={{ color: "#0f172a" }}>
            ¿Por qué funciona?
          </h2>
          <p className="mx-auto mt-3 max-w-xl" style={{ color: "#64748b" }}>
            Publicidad local inteligente, donde la atención ya está garantizada
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {benefits.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "20px",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: "24px",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.1)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "none";
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: b.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 8px 20px ${b.color}55`,
                }}
              >
                <b.icon style={{ width: "26px", height: "26px", color: "#fff" }} />
              </div>
              <div>
                <h3 style={{ marginBottom: "6px", fontWeight: 600, color: "#0f172a", fontSize: "15px" }}>{b.title}</h3>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
