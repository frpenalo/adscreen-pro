import { Link } from "react-router-dom";
import { Check } from "lucide-react";

// ── Precio simple ─────────────────────────────────────────────────────────────
// Un solo plan claro: $60/mes. Sin tablas confusas.

const INCLUDES = [
  "Anuncio en imagen o video",
  "Revisión de tu contenido incluida",
  "Publicación en la red de pantallas",
  "Soporte del equipo",
  "Puedes actualizar tu contenido cuando quieras",
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-16 md:py-20" style={{ background: "#f1f5f9" }}>
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: "#0f172a" }}>
            Precio simple
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg" style={{ color: "#64748b" }}>
            Anuncia tu negocio local por $60/mes. Sin contratos largos. Ideal para
            restaurantes, barbershops, salones, servicios locales, tiendas, eventos y marcas locales.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <div className="animated-border rounded-2xl">
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="bg-primary px-6 py-2 text-center text-sm font-semibold text-primary-foreground">
                Plan único · sin sorpresas
              </div>
              <div className="p-8">
                <h3 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Anúnciate en la red</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-5xl font-extrabold" style={{ color: "#0f172a" }}>$60</span>
                  <span className="mb-1" style={{ color: "#64748b" }}>/ mes</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {INCLUDES.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm" style={{ color: "#334155" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register?role=advertiser"
                  data-track="cta-primary-pricing"
                  className="mt-8 block w-full rounded-lg bg-primary py-3.5 text-center font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Empezar por $60/mes
                </Link>
                <p className="mt-3 text-center text-xs" style={{ color: "#94a3b8" }}>
                  Sin contratos largos · Cancela cuando quieras
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
