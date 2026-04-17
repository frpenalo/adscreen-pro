import { useState } from "react";
import AdvertiserLayout from "@/components/advertiser/AdvertiserLayout";
import HomeScreen from "@/components/advertiser/HomeScreen";
import CreateAdScreen from "@/components/advertiser/CreateAdScreen";
import MyAdsScreen from "@/components/advertiser/MyAdsScreen";
import SubscriptionScreen from "@/components/advertiser/SubscriptionScreen";
import SupportScreen from "@/components/advertiser/SupportScreen";
import CoverageMapScreen from "@/components/advertiser/CoverageMapScreen";
import ContractAcceptanceScreen from "@/components/ContractAcceptanceScreen";
import { useContractAcceptance } from "@/hooks/useContractAcceptance";
import { useAdvertiserProfile } from "@/hooks/useAdvertiserData";
import { useAuth } from "@/contexts/AuthContext";

const AdvertiserDashboard = () => {
  const [page, setPage] = useState("home");
  const { user } = useAuth();
  const { data: acceptance, isLoading: checkingContract } = useContractAcceptance();
  const { data: profile } = useAdvertiserProfile();

  if (!checkingContract && !acceptance && profile) {
    return (
      <ContractAcceptanceScreen
        role="advertiser"
        name={profile.customer_name ?? ""}
        business={profile.business_name ?? ""}
        email={user?.email ?? ""}
        onAccepted={() => {}}
      />
    );
  }

  const renderPage = () => {
    switch (page) {
      case "home": return <HomeScreen onPageChange={setPage} />;
      case "create": return <CreateAdScreen />;
      case "ads": return <MyAdsScreen />;
      case "coverage": return <CoverageMapScreen />;
      case "subscription": return <SubscriptionScreen />;
      case "support": return <SupportScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <AdvertiserLayout currentPage={page} onPageChange={setPage}>
      {renderPage()}
    </AdvertiserLayout>
  );
};

export default AdvertiserDashboard;
