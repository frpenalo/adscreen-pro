import { Link } from "react-router-dom";
import { Check } from "lucide-react";

// ── Precios ───────────────────────────────────────────────────────────────────
// Dos opciones: pantallas solas ($79) o el paquete Kultura 360 con la radio
// ($99). La radio sola se vende en kulturaradio.com, no aquí.

const SCREENS_INCLUDES = [
  "Anuncio visual en imagen o video, 10 segundos por ciclo",
  "Red de 7 pantallas en barberías y salones de Raleigh",
  "Producción de tu anuncio incluida, con una revisión",
  "Soporte del equipo",
  "Puedes actualizar tu contenido cuando quieras",
];

const BUNDLE_INCLUDES = [
  "Todo el plan de pantallas",
  "Cuña de 15 segundos en Kultura Radio, con guion y voz producidos por nosotros",
  "Suena 3 veces al día entre canciones: mañana, tarde y noche",
  "Reporte con cada vez que tu cuña salió al aire",
  "Un solo pago mensual",
];

const IncludesList = ({ items }: { items: string[] }) => (
  <ul className="mt-8 space-y-3">
    {items.map((f, i) => (
      <li key={i} className="flex items-start gap-3">
        <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <span className="text-sm" style={{ color: "#334155" }}>{f}</span>
      </li>
    ))}
  </ul>
);

const PricingSection = () => {
  return (
    <section id="pricing" className="py-16 md:py-20" style={{ background: "#f1f5f9" }}>
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: "#0f172a" }}>
            Precio simple
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg" style={{ color: "#64748b" }}>
            Anuncia tu negocio local por $79/mes, o súmale la radio por $20 más. Sin contratos largos.
            Ideal para restaurantes, barbershops, salones, servicios locales, tiendas, eventos y marcas locales.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl items-start gap-8 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "#e2e8f0" }}>
            <div className="px-6 py-2 text-center text-sm font-semibold" style={{ background: "#e2e8f0", color: "#334155" }}>
              Solo pantallas
            </div>
            <div className="p-8">
              <h3 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Anúnciate en la red</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-5xl font-extrabold" style={{ color: "#0f172a" }}>$79</span>
                <span className="mb-1" style={{ color: "#64748b" }}>/ mes</span>
              </div>
              <IncludesList items={SCREENS_INCLUDES} />
              <Link
                to="/register?role=advertiser"
                data-track="cta-primary-pricing"
                className="mt-8 block w-full rounded-lg border border-primary py-3.5 text-center font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Empezar por $79/mes
              </Link>
              <p className="mt-3 text-center text-xs" style={{ color: "#94a3b8" }}>
                Sin contratos largos · Cancela cuando quieras
              </p>
            </div>
          </div>

          <div className="animated-border rounded-2xl">
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="bg-primary px-6 py-2 text-center text-sm font-semibold text-primary-foreground">
                Recomendado · ahorras $29 al mes
              </div>
              <div className="p-8">
                <h3 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Kultura 360 · pantallas + radio</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-5xl font-extrabold" style={{ color: "#0f172a" }}>$99</span>
                  <span className="mb-1" style={{ color: "#64748b" }}>/ mes</span>
                </div>
                <p className="mt-1 text-sm" style={{ color: "#64748b" }}>Por separado: $128 al mes</p>
                <IncludesList items={BUNDLE_INCLUDES} />
                {/* Va al paso "Antes de pagar" de Kultura (rubros que la radio no
                    acepta), que crea el ref y devuelve a /register con el plan. */}
                <a
                  href="https://kulturaradio.com/anunciate?plan=paquete"
                  data-track="cta-bundle-pricing"
                  className="mt-8 block w-full rounded-lg bg-primary py-3.5 text-center font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Quiero pantallas y radio por $99/mes
                </a>
                <p className="mt-3 text-center text-xs" style={{ color: "#94a3b8" }}>
                  Kultura Radio y AdScreenPro son de la misma casa, Softmedia. El siguiente paso es en
                  kulturaradio.com, donde confirmas tu negocio antes de pagar.
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
