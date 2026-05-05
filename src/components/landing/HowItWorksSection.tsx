import { useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { Upload, Sparkles, Tv } from "lucide-react";
import { AnimatedBeam } from "@/components/magicui/animated-beam";

const steps = [
  {
    icon: Upload,
    num: "01",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.1)",
  },
  {
    icon: Sparkles,
    num: "02",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.1)",
  },
  {
    icon: Tv,
    num: "03",
    color: "#10b981",
    bg: "rgba(16,185,129,0.1)",
  },
];

const HowItWorksSection = () => {
  const { t } = useLang();
  const stepData = [
    { title: t.howItWorks.step1Title, desc: t.howItWorks.step1Desc },
    { title: t.howItWorks.step2Title, desc: t.howItWorks.step2Desc },
    { title: t.howItWorks.step3Title, desc: t.howItWorks.step3Desc },
  ];

  // Refs for AnimatedBeam: container bounds the SVG, the icon refs are
  // the from/to anchor points so the gradient line follows wherever the
  // grid layout puts each step (responsive — desktop vs mobile).
  const containerRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const stepRefs = [step1Ref, step2Ref, step3Ref];

  return (
    <section id="how-it-works" className="py-12 md:py-16" style={{ background: "#f1f5f9" }}>
      <div className="container">
        <div className="text-center">
          <h2 className="text-3xl font-bold md:text-4xl" style={{ color: "#0f172a" }}>
            {t.howItWorks.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl" style={{ color: "#64748b" }}>
            Crear y publicar tu anuncio nunca había sido tan fácil
          </p>
        </div>

        <div ref={containerRef} className="mt-14 grid gap-0 md:grid-cols-3 relative">
          {/* AnimatedBeam overlay — absolute-positioned so it doesn't take
              a grid cell (last bug: the wrapper was eating column 1, which
              pushed step 1 into column 2 and step 3 onto a new row).
              Hidden under md because beams between vertically-stacked
              steps would zig-zag awkwardly. */}
          <div className="absolute inset-0 pointer-events-none hidden md:block">
            <AnimatedBeam
              containerRef={containerRef}
              fromRef={step1Ref}
              toRef={step2Ref}
              gradientStartColor="#3b82f6"
              gradientStopColor="#8b5cf6"
              duration={4}
            />
            <AnimatedBeam
              containerRef={containerRef}
              fromRef={step2Ref}
              toRef={step3Ref}
              gradientStartColor="#8b5cf6"
              gradientStopColor="#10b981"
              duration={4}
              delay={1.5}
            />
          </div>

          {stepData.map((step, i) => (
            <div
              key={i}
              style={{
                borderRadius: "16px",
                padding: "32px 24px",
                textAlign: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* Icon circle */}
              <div
                ref={stepRefs[i]}
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: steps[i].color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  position: "relative",
                  boxShadow: `0 8px 24px ${steps[i].color}55`,
                }}
              >
                {(() => { const Icon = steps[i].icon; return <Icon style={{ width: "28px", height: "28px", color: "#fff" }} />; })()}
                {/* Step number badge */}
                <div
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: steps[i].color,
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </div>
              </div>

              <h3 style={{ marginBottom: "10px", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.65 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
