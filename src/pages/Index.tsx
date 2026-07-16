import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import LocalProofSection from "@/components/landing/LocalProofSection";
import ImpactSection from "@/components/landing/ImpactSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import AudiencesSection from "@/components/landing/AudiencesSection";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";
import FinalCtaSection from "@/components/landing/FinalCtaSection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <LocalProofSection />
      <ImpactSection />
      <HowItWorksSection />
      <AudiencesSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
      <Footer />
    </div>
  );
};

export default Index;
