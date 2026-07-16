import { useState } from "react";
import { ChevronDown } from "lucide-react";

// ── FAQ ───────────────────────────────────────────────────────────────────────
// Las 9 preguntas del brief, en un acordeón ligero (sin dependencias extra).
// El mismo contenido está también en el JSON-LD de index.html para SEO/GEO.

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Cuánto cuesta anunciarme?",
    a: "Desde $60 al mes. Sin contratos largos: puedes cancelar cuando quieras avisando con anticipación. El precio incluye tu anuncio en la red de pantallas, revisión de tu contenido y soporte.",
  },
  {
    q: "¿Dónde aparece mi anuncio?",
    a: "En pantallas digitales instaladas en barberías, salones y negocios locales de Raleigh, NC. Tu anuncio se muestra en rotación frente a clientes reales mientras esperan o reciben su servicio.",
  },
  {
    q: "¿Cuántas pantallas hay?",
    a: "Actualmente hay 7 pantallas listas y activas en Raleigh, y la red sigue creciendo. Tu anuncio entra en la rotación de la red de pantallas disponibles.",
  },
  {
    q: "¿Puedo cancelar?",
    a: "Sí. No hay contratos largos ni penalidades. Avisas con anticipación y listo — pagas mes a mes.",
  },
  {
    q: "¿Qué formato debe tener mi anuncio?",
    a: "Imágenes (JPG, PNG, WEBP) o videos (MP4, MOV) en formato horizontal 16:9. Si solo tienes una foto, nuestra herramienta con IA te ayuda a convertirla en un anuncio listo para pantalla.",
  },
  {
    q: "¿Cuánto tarda en publicarse?",
    a: "Normalmente en menos de 24 horas. Subes tu anuncio, nuestro equipo lo revisa y aprueba, y aparece en las pantallas de la red.",
  },
  {
    q: "¿Puedo cambiar mi anuncio?",
    a: "Sí, cuando quieras. Desde tu panel puedes actualizar tu contenido y enviarlo a revisión para publicar la nueva versión.",
  },
  {
    q: "¿Cómo funciona para barberías o partners?",
    a: "Si tienes un negocio y quieres colocar una pantalla, te registras como partner. Nosotros activamos la pantalla y tú generas ingresos por los anunciantes que se muestran en ella, sin costo ni trabajo de tu parte.",
  },
  {
    q: "¿Quién opera AdScreenPro?",
    a: "AdScreenPro es operado por SOFTMEDIA LLC (DBA AdScreenPro), una empresa local con base en Raleigh, North Carolina.",
  },
];

const FaqSection = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 md:py-20" style={{ background: "#f1f5f9" }}>
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: "#0f172a" }}>
            Preguntas frecuentes
          </h2>
          <p className="mt-3 text-lg" style={{ color: "#64748b" }}>
            Todo lo que necesitas saber antes de anunciarte.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl border bg-white transition-shadow"
                style={{ borderColor: isOpen ? "#c7d2fe" : "#e2e8f0", boxShadow: isOpen ? "0 4px 20px rgba(59,130,246,0.08)" : "none" }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold md:text-base" style={{ color: "#0f172a" }}>
                    {f.q}
                  </span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 transition-transform"
                    style={{ color: "#6366f1", transform: isOpen ? "rotate(180deg)" : "none" }}
                  />
                </button>
                <div
                  className="grid transition-all duration-300"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
