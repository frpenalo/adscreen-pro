import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Play, Wifi, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/magicui/border-beam";

// ── Rotating ad scenes ────────────────────────────────────────────────────────
// Each entry drives ONE of the 3 TV mockups. The scenes cycle on a
// staggered timer so the mosaic feels alive — not all TVs change at
// once, mimicking how the real fleet rotates content asynchronously.
const SCENES = [
  {
    gradient: "linear-gradient(135deg, #4c1d95 0%, #c026d3 100%)",
    emoji: "💇",
    business: "FADE FACTORY",
    offer: "Corte premium $25",
    badge: "HOY",
    badgeColor: "#fbbf24",
  },
  {
    gradient: "linear-gradient(135deg, #064e3b 0%, #10b981 100%)",
    emoji: "🥑",
    business: "GREEN BOWL",
    offer: "Bowl + jugo $12",
    badge: "ALMUERZO",
    badgeColor: "#f97316",
  },
  {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
    emoji: "💪",
    business: "GYM PRO",
    offer: "Primer mes gratis",
    badge: "NUEVO",
    badgeColor: "#a78bfa",
  },
  {
    gradient: "linear-gradient(135deg, #831843 0%, #ec4899 100%)",
    emoji: "💅",
    business: "LA BEAUTE",
    offer: "Manicure $20",
    badge: "OFERTA",
    badgeColor: "#22d3ee",
  },
  {
    gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
    emoji: "🍕",
    business: "PIZZA EXPRESS",
    offer: "2x1 martes",
    badge: "POPULAR",
    badgeColor: "#facc15",
  },
];

// ── Rotating words for the kinetic headline ──────────────────────────────────
// The headline alternates the trailing word — "Tus anuncios en pantallas
// reales" / "Tus anuncios en negocios reales" / etc. The animation is
// short (3s per word) so visitors who skim still see motion within seconds.
const HEADLINE_WORDS = [
  { text: "pantallas reales", color: "#a78bfa" },
  { text: "negocios reales", color: "#22d3ee" },
  { text: "clientes reales", color: "#f472b6" },
];

// ── TV mockup — single ad screen ─────────────────────────────────────────────
// Used 3x in the hero mosaic, each at a different perspective angle and
// cycling through SCENES on its own timer offset. The mockup keeps the
// "live screen" feel (status dot, AdScreenPro watermark, soft scanlines)
// so the hero communicates "real signage in real venues" not "stock photo".
interface TVProps {
  sceneIdx: number;
  rotateY: number;
  rotateX: number;
  translateZ: number;
  scale: number;
  showBeam?: boolean;
  zIndex: number;
}
const TVMockup = ({ sceneIdx, rotateY, rotateX, translateZ, scale, showBeam, zIndex }: TVProps) => {
  const scene = SCENES[sceneIdx % SCENES.length];
  return (
    <div
      className="absolute"
      style={{
        transform: `perspective(1200px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateZ(${translateZ}px) scale(${scale})`,
        transformStyle: "preserve-3d",
        zIndex,
      }}
    >
      <div
        className="relative rounded-2xl"
        style={{
          background: "linear-gradient(145deg, #0f172a 0%, #020617 100%)",
          padding: "10px 10px 24px 10px",
          width: "440px",
          boxShadow:
            "0 32px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {showBeam && (
          <>
            <BorderBeam size={140} duration={7} colorFrom="#a78bfa" colorTo="#ec4899" borderWidth={2} />
            <BorderBeam size={100} duration={7} delay={3.5} colorFrom="#22d3ee" colorTo="#a78bfa" borderWidth={2} />
          </>
        )}

        {/* Bezel top: status dots + connection indicator */}
        <div className="flex items-center justify-between px-2 pb-2 opacity-60">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-500 tracking-widest uppercase">
            <Wifi className="h-2 w-2" />
            <span>Live</span>
          </div>
        </div>

        {/* Screen */}
        <motion.div
          key={sceneIdx}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-lg"
          style={{
            aspectRatio: "16/9",
            background: scene.gradient,
          }}
        >
          <div
            className="absolute right-3 top-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ background: scene.badgeColor, letterSpacing: "0.1em" }}
          >
            {scene.badge}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <div style={{ fontSize: "48px", lineHeight: 1 }}>{scene.emoji}</div>
            <div className="text-center text-base font-extrabold uppercase tracking-wide text-white"
                 style={{ textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}>
              {scene.business}
            </div>
            <div className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {scene.offer}
            </div>
          </div>
          {/* Scanlines for screen feel */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
            }}
          />
        </motion.div>

        {/* Stand */}
        <div className="mx-auto mt-0 h-3 w-10 rounded-b bg-slate-800" />
        <div className="mx-auto h-1 w-20 rounded bg-slate-800" />
      </div>
    </div>
  );
};

// ── Mosaic of 3 TVs ──────────────────────────────────────────────────────────
const TVMosaic = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-[520px] w-full" style={{ perspective: "1400px" }}>
      {/* Halo glow behind the mosaic */}
      <div
        className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(167,139,250,0.35) 0%, rgba(34,211,238,0.15) 35%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Back-left TV */}
      <div className="absolute left-0 top-12">
        <TVMockup
          sceneIdx={tick + 1}
          rotateY={22}
          rotateX={-3}
          translateZ={-80}
          scale={0.75}
          zIndex={1}
        />
      </div>

      {/* Back-right TV */}
      <div className="absolute right-0 top-4">
        <TVMockup
          sceneIdx={tick + 2}
          rotateY={-22}
          rotateX={-3}
          translateZ={-80}
          scale={0.75}
          zIndex={1}
        />
      </div>

      {/* Front-center hero TV (with border beam) */}
      <div className="absolute left-1/2 top-32 -translate-x-1/2">
        <TVMockup
          sceneIdx={tick}
          rotateY={0}
          rotateX={0}
          translateZ={0}
          scale={1.02}
          showBeam
          zIndex={2}
        />
      </div>
    </div>
  );
};

// ── Kinetic headline word swap ───────────────────────────────────────────────
const RotatingWord = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % HEADLINE_WORDS.length), 2800);
    return () => clearInterval(id);
  }, []);
  const word = HEADLINE_WORDS[idx];
  return (
    <span className="relative inline-block">
      <motion.span
        key={idx}
        initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ color: word.color, display: "inline-block" }}
      >
        {word.text}
      </motion.span>
    </span>
  );
};

// ── Live partner counter ─────────────────────────────────────────────────────
// Shown as a trust signal above the headline. Currently hard-coded to 8 to
// avoid hammering the DB from a public page; bump manually or wire a
// cached SECURITY DEFINER RPC if/when the count starts mattering for
// honesty (e.g. >50 partners and the round number lies more than helps).
const LIVE_PARTNERS = 8;

const HeroSection = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-login");
      if (error) throw error;
      if (data?.access_token && data?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        navigate("/dashboard/advertiser");
      }
    } catch (e: any) {
      console.error("Demo login error:", e);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <section
      className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
      }}
    >
      {/* ── Animated grid background ────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 90%)",
        }}
      />

      {/* ── Ambient orbs (subtle, blurred) ──────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-32 right-0 h-[500px] w-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 left-0 h-[400px] w-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 65%)",
        }}
      />

      {/* ── Content grid ────────────────────────────────────────────────── */}
      <div className="container relative grid items-center gap-12 md:grid-cols-2 md:gap-8 lg:gap-16">
        {/* ── Left column: copy + CTAs ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-7"
        >
          {/* Live partner trust badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 py-1.5 pl-2 pr-4 text-sm font-medium text-violet-200 backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>{LIVE_PARTNERS} negocios activos en Raleigh ahora</span>
          </motion.div>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
            Tus anuncios en{" "}
            <span className="relative whitespace-nowrap">
              <RotatingWord />
            </span>
          </h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-xl text-lg leading-relaxed text-slate-300 md:text-xl"
          >
            Llegamos a clientes en barberías, salones y restaurantes mientras esperan su turno. Audiencia cautiva, sin scroll, sin saltar el anuncio.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-wrap gap-3"
          >
            <Link
              to="/register?role=advertiser"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-7 py-4 text-base font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #ec4899 100%)",
                boxShadow:
                  "0 8px 30px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <Sparkles className="h-4 w-4" />
              <span>Comenzar gratis</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDemo}
              disabled={demoLoading}
              className="gap-2 rounded-xl border-white/15 bg-white/5 text-slate-200 backdrop-blur hover:bg-white/10 hover:text-white"
            >
              <Play className="h-4 w-4" />
              {demoLoading ? t.hero.demoLoading : t.hero.demo}
            </Button>
          </motion.div>

          {/* Microtrust under CTAs */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-xs text-slate-400"
          >
            Sin contrato · Cancela cuando quieras · Setup en menos de 5 min
          </motion.p>
        </motion.div>

        {/* ── Right column: TV mosaic ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          className="relative hidden md:block"
        >
          <TVMosaic />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
