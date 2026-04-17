import { useLang } from "@/contexts/LangContext";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const PricingSection = () => {
  const { t } = useLang();

  const features = [
    "Publicación ilimitada de anuncios",
    "Editor con IA y plantillas profesionales",
    "Panel de control para gestionar tus anuncios",
    "Soporte prioritario por WhatsApp",
    "Reportes de visualizaciones mensuales",
  ];

  return (
    <section id="pricing" className="py-12 md:py-16" style={{ background: "#f1f5f9" }}>
      <div className="container">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">{t.pricing.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t.pricing.description}</p>
        </div>
        <div className="mx-auto mt-14 max-w-md">
          <div className="animated-border rounded-2xl">
            <div className="relative overflow-hidden rounded-2xl bg-card shadow-lg">
              <div className="bg-primary px-6 py-2 text-center text-sm font-medium text-primary-foreground">
                Más popular
              </div>
              <div className="p-8">
                <h3 className="text-lg font-semibold text-foreground">Plan Mensual</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-5xl font-extrabold text-foreground">{t.pricing.price}</span>
                  <span className="mb-1 text-muted-foreground">/ mes</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register?role=advertiser"
                  className="mt-8 block w-full rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Regístrate y crea tu anuncio
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
