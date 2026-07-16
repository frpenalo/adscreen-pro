import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Check, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

// ── /raleigh-local-ads ────────────────────────────────────────────────────────
// Landing enfocada 100% en anunciantes locales de Raleigh. Un solo objetivo:
// captar el lead. El formulario guarda en advertiser_leads (ver migración
// 20260707000000) y ofrece continuar al registro completo.

const BUSINESS_TYPES = [
  "Restaurante", "Barbería", "Salón de belleza", "Uñas / Spa", "Tienda / Retail",
  "Gimnasio / Fitness", "Servicios (dentista, taller, etc.)", "Eventos", "Otro",
];

const BENEFITS = [
  "Frente a clientes reales mientras esperan su turno",
  "Desde $60/mes, sin contratos largos",
  "Nosotros revisamos y publicamos tu anuncio",
  "Resultados medibles con QR y cupones",
];

const RaleighLocalAds = () => {
  const [form, setForm] = useState({ name: "", business_name: "", phone: "", email: "", business_type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insErr } = await supabase.from("advertiser_leads" as any).insert({
        name: form.name.trim(),
        business_name: form.business_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        business_type: form.business_type || null,
        message: form.message.trim() || null,
        source: "raleigh-local-ads",
      });
      if (insErr) throw insErr;
      setDone(true);
    } catch (err: any) {
      setError("No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#0b1020" }}>
      {/* minimal nav */}
      <nav className="border-b border-white/10">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white">AdScreenPro</Link>
          <Link to="/login" className="text-sm text-slate-300 hover:text-white">Iniciar sesión</Link>
        </div>
      </nav>

      <div className="container grid items-start gap-10 py-14 md:grid-cols-2 md:gap-12 md:py-20">
        {/* ── Left: pitch ── */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-sm font-semibold text-emerald-300">
            <MapPin className="h-4 w-4" /> Raleigh, North Carolina
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            Anuncia tu negocio en pantallas locales de Raleigh por{" "}
            <span style={{ background: "linear-gradient(90deg,#34d399,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              $60/mes
            </span>
            .
          </h1>
          <p className="max-w-lg text-lg text-slate-300">
            Tu anuncio aparece en barberías, salones y negocios locales, frente a
            clientes reales. Déjanos tus datos y te contamos cómo empezar.
          </p>
          <ul className="space-y-3 pt-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <span className="text-slate-200">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: form ── */}
        <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-2xl md:p-8">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <h2 className="text-xl font-bold text-slate-900">¡Recibido! Te contactamos pronto.</h2>
              <p className="text-sm text-slate-600">
                Gracias, {form.name.split(" ")[0]}. Si quieres, puedes crear tu cuenta ahora y dejar tu primer anuncio listo.
              </p>
              <Link
                to="/register?role=advertiser"
                data-track="lead-to-register"
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
              >
                Crear mi cuenta <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-track="lead-form">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Quiero anunciarme</h2>
                <p className="mt-1 text-sm text-slate-500">Te respondemos en menos de 24h.</p>
              </div>

              <Field label="Nombre *">
                <input required value={form.name} onChange={set("name")} className={inputCls} placeholder="Tu nombre" />
              </Field>
              <Field label="Nombre del negocio">
                <input value={form.business_name} onChange={set("business_name")} className={inputCls} placeholder="Ej. Tacos El Güero" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Teléfono">
                  <input value={form.phone} onChange={set("phone")} className={inputCls} placeholder="919-555-0101" inputMode="tel" />
                </Field>
                <Field label="Email">
                  <input value={form.email} onChange={set("email")} className={inputCls} placeholder="tu@correo.com" type="email" />
                </Field>
              </div>
              <Field label="Tipo de negocio">
                <select value={form.business_type} onChange={set("business_type")} className={inputCls}>
                  <option value="">Selecciona…</option>
                  {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Mensaje (opcional)">
                <textarea value={form.message} onChange={set("message")} className={`${inputCls} min-h-[80px] resize-y`} placeholder="Cuéntanos qué quieres promocionar" />
              </Field>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                data-track="lead-submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Enviando…" : "Quiero anunciarme"}
              </button>
              <p className="text-center text-xs text-slate-400">
                Sin compromiso · Sin contratos largos
              </p>
            </form>
          )}
        </div>
      </div>

      <footer className="border-t border-white/10 py-8 text-center">
        <p className="text-xs text-slate-500">© 2026 SOFTMEDIA LLC DBA AdScreenPro · Raleigh, NC</p>
      </footer>
    </div>
  );
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

export default RaleighLocalAds;
