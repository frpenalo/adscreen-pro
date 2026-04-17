import { useLang } from "@/contexts/LangContext";
import { Upload, Sparkles, Tv } from "lucide-react";

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

        <div className="mt-14 grid gap-0 md:grid-cols-3 relative">
          {/* Connector line (desktop only) */}
          <div
            className="hidden md:block"
            style={{
              position: "absolute",
              top: "36px",
              left: "calc(16.66% + 24px)",
              right: "calc(16.66% + 24px)",
              height: "2px",
              background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #10b981)",
              zIndex: 0,
            }}
          />

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
