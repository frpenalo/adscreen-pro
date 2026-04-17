import { useState } from "react";
import PartnerLayout from "@/components/partner/PartnerLayout";
import ReportsScreen from "@/components/partner/ReportsScreen";
import ReferralsScreen from "@/components/partner/ReferralsScreen";
import PayoutsScreen from "@/components/partner/PayoutsScreen";
import ProfileScreen from "@/components/partner/ProfileScreen";
import SupportScreen from "@/components/partner/SupportScreen";
import PartnerAdsScreen from "@/components/partner/PartnerAdsScreen";
import ContractAcceptanceScreen from "@/components/ContractAcceptanceScreen";
import { useContractAcceptance } from "@/hooks/useContractAcceptance";
import { usePartnerProfile } from "@/hooks/usePartnerData";
import { useAuth } from "@/contexts/AuthContext";

const PartnerDashboard = () => {
  const [page, setPage] = useState("reports");
  const { user } = useAuth();
  const { data: acceptance, isLoading: checkingContract } = useContractAcceptance();
  const { data: profile } = usePartnerProfile();

  if (!checkingContract && !acceptance && profile) {
    return (
      <ContractAcceptanceScreen
        role="partner"
        name={profile.contact_name ?? ""}
        business={profile.business_name ?? ""}
        email={user?.email ?? ""}
        onAccepted={() => {}}
      />
    );
  }

  const renderPage = () => {
    switch (page) {
      case "reports": return <ReportsScreen />;
      case "ads": return <PartnerAdsScreen />;
      case "referrals": return <ReferralsScreen />;
      case "payouts": return <PayoutsScreen />;
      case "profile": return <ProfileScreen />;
      case "support": return <SupportScreen />;
      default: return <ReportsScreen />;
    }
  };

  return (
    <PartnerLayout currentPage={page} onPageChange={setPage}>
      {renderPage()}
    </PartnerLayout>
  );
};

export default PartnerDashboard;
