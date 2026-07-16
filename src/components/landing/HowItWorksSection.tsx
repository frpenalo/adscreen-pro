import { Upload, CheckCircle2, Tv, ClipboardList, MonitorSmartphone, TrendingUp } from "lucide-react";

// ── Cómo funciona ─────────────────────────────────────────────────────────────
// Dos recorridos de 3 pasos: uno para anunciantes, otro para partners.

const ADVERTISER_STEPS = [
  { icon: Upload, title: "Envías o subes tu anuncio", desc: "Sube tu imagen o video, o parte de una sola foto — nuestra IA te arma el anuncio.", color: "#7c3aed" },
  { icon: CheckCircle2, title: "Lo revisamos y aprobamos", desc: "Nuestro equipo revisa tu contenido para que salga bien en pantalla. Normalmente en menos de 24h.", color: "#c026d3" },
  { icon: Tv, title: "Tu anuncio aparece en pantallas locales", desc: "Entra en la rotación de la red, frente a clientes reales en barberías y salones de Raleigh.", color: "#ec4899" },
];

const PARTNER_STEPS = [
  { icon: ClipboardList, title: "Registras tu negocio", desc: "Te apuntas como partner en unos minutos. Sin costo.", color: "#0891b2" },
  { icon: MonitorSmartphone, title: "Instalamos o activamos la pantalla", desc: "Te ayudamos a poner tu TV a mostrar la red de anuncios.", color: "#0ea5e9" },
  { icon: TrendingUp, title: "Ganas por anuncios y referidos", desc: "Recibes ingresos por cada anunciante activo en tu pantalla, según el programa.", color: "#10b981" },
];

type Step = { icon: typeof Upload; title: string; desc: string; color: string };

const Track = ({ label, steps }: { label: string; steps: Step[] }) => (
  <div>
    <div className="mb-6 flex items-center gap-3">
      <span className="text-sm font-bold uppercase tracking-widest" style={{ color: steps[0].color }}>{label}</span>
      <div className="h-px flex-1" style={{ background: "#e2e8f0" }} />
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      {steps.map((s, i) => (
        <div key={i} className="relative rounded-2xl border p-6" style={{ borderColor: "#e2e8f0", background: "#ffffff" }}>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: s.color, boxShadow: `0 8px 22px ${s.color}44` }}
          >
            <s.icon className="h-7 w-7 text-white" />
          </div>
          <div
            className="absolute right-5 top-5 text-3xl font-extrabold"
            style={{ color: `${s.color}22` }}
          >
            {i + 1}
          </div>
          <h3 className="mt-4 text-base font-bold" style={{ color: "#0f172a" }}>{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-20" style={{ background: "#f8fafc" }}>
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: "#0f172a" }}>
            Cómo funciona
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg" style={{ color: "#64748b" }}>
            Simple para todos: en 3 pasos estás al aire o generando ingresos.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl space-y-12">
          <Track label="Para anunciantes" steps={ADVERTISER_STEPS} />
          <Track label="Para partners" steps={PARTNER_STEPS} />
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
