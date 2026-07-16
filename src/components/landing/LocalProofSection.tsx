import { MapPin, Scissors, Sparkles, UtensilsCrossed, ImageIcon } from "lucide-react";

// ── Prueba local ──────────────────────────────────────────────────────────────
// Muestra que la red es REAL y local: 7 pantallas activas en Raleigh + espacio
// para fotos reales de las instalaciones y ejemplos de anuncios. Los
// placeholders están claramente etiquetados para que Francisco los reemplace
// con imágenes reales (public/screens/*.jpg) sin tocar el layout.

const ACTIVE_SCREENS = 7;

// Cuando haya fotos reales, reemplazar `photo` por la ruta (ej.
// "/screens/fade-factory.jpg"). Mientras sea null se muestra un placeholder
// limpio. NO inventamos nombres/direcciones exactas — son tipos de negocio.
const VENUE_PLACEHOLDERS: { type: string; icon: typeof Scissors; photo: string | null; tint: string }[] = [
  { type: "Barbería", icon: Scissors, photo: null, tint: "#a78bfa" },
  { type: "Salón de belleza", icon: Sparkles, photo: null, tint: "#f472b6" },
  { type: "Restaurante local", icon: UtensilsCrossed, photo: null, tint: "#22d3ee" },
];

const LocalProofSection = () => {
  return (
    <section id="prueba-local" className="relative overflow-hidden py-16 md:py-20" style={{ background: "#0b1020" }}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.14) 0%, transparent 70%)", filter: "blur(50px)" }}
      />

      <div className="container relative">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-sm font-semibold text-emerald-300">
            <MapPin className="h-4 w-4" />
            Raleigh, North Carolina
          </div>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            <span
              style={{
                background: "linear-gradient(90deg, #34d399, #22d3ee)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {ACTIVE_SCREENS} pantallas
            </span>{" "}
            listas y activas en negocios de Raleigh
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            No es una promesa a futuro: son pantallas reales, encendidas hoy, en
            barberías, salones y negocios locales — frente a clientes que esperan su turno.
          </p>
        </div>

        {/* Fotos reales de pantallas instaladas (placeholders) */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VENUE_PLACEHOLDERS.map((v) => (
            <div
              key={v.type}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              style={{ aspectRatio: "4/3" }}
            >
              {v.photo ? (
                <img src={v.photo} alt={`Pantalla AdScreenPro en ${v.type}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: `${v.tint}22`, boxShadow: `0 0 24px ${v.tint}33` }}
                  >
                    <v.icon className="h-7 w-7" style={{ color: v.tint }} />
                  </div>
                  <span className="text-sm font-semibold text-white">{v.type}</span>
                  <span className="text-[11px] uppercase tracking-widest text-slate-500">
                    Foto real próximamente
                  </span>
                </div>
              )}
              {/* Etiqueta "Pantalla activa" */}
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white">Activa</span>
              </div>
            </div>
          ))}
        </div>

        {/* Ejemplos de anuncios reales (placeholders 16:9) */}
        <div className="mt-14">
          <h3 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
            Así se ve un anuncio en pantalla
          </h3>
          <div className="mx-auto mt-6 grid max-w-4xl gap-5 sm:grid-cols-3">
            {["Tu logo + oferta", "Tu foto de producto", "Tu promo de la semana"].map((label, i) => (
              <div
                key={i}
                className="relative flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900"
                style={{ aspectRatio: "16/9" }}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <ImageIcon className="h-6 w-6 text-slate-600" />
                  <span className="px-3 text-xs font-medium text-slate-400">{label}</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-600">Ejemplo</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-lg text-center text-xs text-slate-500">
            Reemplazables con anuncios reales de tus clientes cuando los tengas listos.
          </p>
        </div>
      </div>
    </section>
  );
};

export default LocalProofSection;
