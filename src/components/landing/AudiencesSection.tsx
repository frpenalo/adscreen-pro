import { Link } from "react-router-dom";
import { ArrowRight, Megaphone, Store, Check } from "lucide-react";

// ── Dos audiencias ────────────────────────────────────────────────────────────
// Separa claramente los dos públicos: anunciantes (quieren promocionarse) y
// partners (quieren poner una pantalla y ganar). Cada uno con su mensaje,
// beneficios y CTA propios.

const ADVERTISER_BENEFITS = [
  "Frente a clientes reales, no scroll ni anuncios saltables",
  "Desde $60/mes, sin contratos largos",
  "Nosotros revisamos y publicamos tu anuncio",
  "Cambia tu contenido cuando quieras",
];

const PARTNER_BENEFITS = [
  "Convierte tu TV en un ingreso pasivo",
  "Cero costo y cero trabajo para ti",
  "Ganas por cada anunciante que se suma en tu pantalla",
  "Tu local se ve más premium",
];

const AudiencesSection = () => {
  return (
    <section id="beneficios" className="py-16 md:py-20" style={{ background: "#ffffff" }}>
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: "#0f172a" }}>
            Dos formas de crecer con AdScreenPro
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg" style={{ color: "#64748b" }}>
            Ya sea que quieras anunciar tu negocio o poner una pantalla en el tuyo.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
          {/* ── Anunciantes ── */}
          <div
            className="relative flex flex-col rounded-3xl p-8"
            style={{ background: "linear-gradient(160deg, #f5f3ff 0%, #faf5ff 100%)", border: "1px solid #e9d5ff" }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }}>
              <Megaphone className="h-7 w-7 text-white" />
            </div>
            <span className="mt-5 text-xs font-bold uppercase tracking-widest" style={{ color: "#9333ea" }}>
              Para anunciantes
            </span>
            <h3 className="mt-2 text-2xl font-bold" style={{ color: "#0f172a" }}>
              Pon tu negocio frente a clientes locales por solo $60/mes
            </h3>
            <ul className="mt-6 flex-1 space-y-3">
              {ADVERTISER_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "#9333ea" }} />
                  <span className="text-sm" style={{ color: "#334155" }}>{b}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/register?role=advertiser"
              data-track="cta-advertiser-audiences"
              className="group mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}
            >
              Quiero anunciarme
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* ── Partners ── */}
          <div
            className="relative flex flex-col rounded-3xl p-8"
            style={{ background: "linear-gradient(160deg, #ecfeff 0%, #f0fdfa 100%)", border: "1px solid #a5f3fc" }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, #0891b2, #10b981)" }}>
              <Store className="h-7 w-7 text-white" />
            </div>
            <span className="mt-5 text-xs font-bold uppercase tracking-widest" style={{ color: "#0891b2" }}>
              Para partners
            </span>
            <h3 className="mt-2 text-2xl font-bold" style={{ color: "#0f172a" }}>
              Convierte tu espacio en una oportunidad de ingresos con una pantalla
            </h3>
            <ul className="mt-6 flex-1 space-y-3">
              {PARTNER_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "#0891b2" }} />
                  <span className="text-sm" style={{ color: "#334155" }}>{b}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/register?role=partner"
              data-track="cta-partner-audiences"
              className="group mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #0891b2, #10b981)", boxShadow: "0 8px 24px rgba(8,145,178,0.35)" }}
            >
              Quiero poner una pantalla
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AudiencesSection;
