import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

// ── CTA final ─────────────────────────────────────────────────────────────────
// Último empujón antes del footer. Reafirma la oferta local concreta y el precio.

const FinalCtaSection = () => {
  return (
    <section className="relative overflow-hidden py-20 md:py-24" style={{ background: "radial-gradient(ellipse 70% 80% at 50% 100%, #1e1b4b 0%, #0b1020 60%, #020617 100%)" }}>
      {/* grid + glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 85%)",
        }}
      />
      <div className="container relative text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white md:text-4xl lg:text-5xl">
          Tu negocio, frente a clientes de Raleigh
          <br className="hidden md:block" />
          <span
            style={{
              background: "linear-gradient(90deg, #a78bfa, #ec4899)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {" "}desde $60/mes
          </span>
          .
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg text-slate-300">
          Publicidad local de verdad, sin contratos largos. Nosotros nos encargamos de revisar y publicar tu anuncio.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register?role=advertiser"
            data-track="cta-primary-final"
            className="group inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #ec4899 100%)",
              boxShadow: "0 8px 30px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            Empezar por $60/mes
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/register?role=partner"
            data-track="cta-partner-final"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-slate-200 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
          >
            Tengo un local para una pantalla
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCtaSection;
