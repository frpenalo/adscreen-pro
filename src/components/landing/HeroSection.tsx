import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Play, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const adSlides = [
  {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
    emoji: "🍕",
    business: "PIZZERÍA LA ESQUINA",
    offer: "2x1 todos los martes",
    badge: "OFERTA",
    badgeColor: "#f59e0b",
  },
  {
    gradient: "linear-gradient(135deg, #065f46 0%, #10b981 100%)",
    emoji: "💊",
    business: "FARMACIA CENTRAL",
    offer: "Descuentos del 20%",
    badge: "HOY",
    badgeColor: "#ef4444",
  },
  {
    gradient: "linear-gradient(135deg, #7c2d12 0%, #f97316 100%)",
    emoji: "💪",
    business: "GYM FITNESS PRO",
    offer: "Primer mes gratis",
    badge: "NUEVO",
    badgeColor: "#8b5cf6",
  },
];

const ScreenMockup = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActiveSlide((prev) => (prev + 1) % adSlides.length);
        setFading(false);
      }, 500);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const slide = adSlides[activeSlide];

  return (
    <div className="animate-float relative flex justify-center md:justify-end">
      {/* Glow behind TV */}
      <div
        style={{
          position: "absolute",
          inset: "10%",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.25) 0%, transparent 70%)",
          filter: "blur(24px)",
          zIndex: 0,
        }}
      />

      {/* TV body */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "#0f172a",
          borderRadius: "18px",
          padding: "10px 10px 28px 10px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
          width: "100%",
          maxWidth: "480px",
        }}
      >
        {/* Screen bezel top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 8px", opacity: 0.5 }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: i === activeSlide ? "#3b82f6" : "#334155",
                  transition: "background 0.4s",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "10px" }}>
            <Wifi size={10} />
            <span>AdScreenPro</span>
          </div>
        </div>

        {/* Screen content */}
        <div
          style={{
            borderRadius: "10px",
            overflow: "hidden",
            aspectRatio: "16/9",
            position: "relative",
            background: slide.gradient,
            transition: "opacity 0.5s ease",
            opacity: fading ? 0 : 1,
          }}
        >
          {/* Badge */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: slide.badgeColor,
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.08em",
            }}
          >
            {slide.badge}
          </div>

          {/* Ad content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "20px",
            }}
          >
            <div style={{ fontSize: "48px", lineHeight: 1 }}>{slide.emoji}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: "18px", textAlign: "center", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {slide.business}
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(4px)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                padding: "6px 16px",
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {slide.offer}
            </div>
          </div>

          {/* Scanline overlay for screen feel */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* TV stand */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "0px" }}>
          <div style={{ width: "40px", height: "18px", background: "#1e293b", borderRadius: "0 0 4px 4px" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: "80px", height: "4px", background: "#1e293b", borderRadius: "2px" }} />
        </div>
      </div>

      {/* Floating notification */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "-10px",
          background: "#fff",
          borderRadius: "12px",
          padding: "10px 14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          fontWeight: 600,
          color: "#0f172a",
          zIndex: 2,
          animation: "fadeIn 0.6s ease-out 0.8s both",
        }}
      >
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
        Anuncio publicado en vivo
      </div>
    </div>
  );
};

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
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        position: "relative",
        overflow: "hidden",
      }}
      className="pt-20 pb-14 md:pt-28 md:pb-16"
    >
      {/* Subtle grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      {/* Ambient blobs */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-80px",
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-60px",
          left: "-60px",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div className="container relative grid items-center gap-12 md:grid-cols-2">
        {/* Left: copy */}
        <div className="space-y-6 animate-fade-in">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: "20px",
              padding: "4px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#93c5fd",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
            Publicidad digital para negocios locales
          </div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-[3.5rem]" style={{ color: "#f8fafc" }}>
            {t.hero.headline.split("en minutos")[0]}
            <span style={{ color: "#60a5fa" }}>en minutos</span>
          </h1>

          <p className="max-w-lg text-lg" style={{ color: "#94a3b8" }}>
            {t.hero.subheadline}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/register?role=advertiser"
              className="inline-flex items-center gap-2 rounded-lg px-7 py-3.5 text-base font-semibold transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: "#3b82f6", color: "#fff", boxShadow: "0 4px 20px rgba(59,130,246,0.4)" }}
            >
              {t.hero.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDemo}
              disabled={demoLoading}
              className="gap-2"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#cbd5e1", background: "rgba(255,255,255,0.05)" }}
            >
              <Play className="h-4 w-4" />
              {demoLoading ? t.hero.demoLoading : t.hero.demo}
            </Button>
          </div>
        </div>

        {/* Right: animated screen mockup */}
        <ScreenMockup />
      </div>
    </section>
  );
};

export default HeroSection;
