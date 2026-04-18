import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdvertisersScreen from "@/components/admin/AdvertisersScreen";
import PartnersScreen from "@/components/admin/PartnersScreen";
import ContentScreen from "@/components/admin/ContentScreen";
import ReferralsScreen from "@/components/admin/ReferralsScreen";
import PayoutsScreen from "@/components/admin/PayoutsScreen";
import ImportCsvScreen from "@/components/admin/ImportCsvScreen";
import SettingsScreen from "@/components/admin/SettingsScreen";
import NotificationsScreen from "@/components/admin/NotificationsScreen";
import ScreensMapScreen from "@/components/admin/ScreensMapScreen";
import SalesTemplatesScreen from "@/components/admin/SalesTemplatesScreen";
import ProductsScreen from "@/components/admin/ProductsScreen";

const AdminDashboard = () => {
  const [page, setPage] = useState("advertisers");

  const renderPage = () => {
    switch (page) {
      case "advertisers": return <AdvertisersScreen />;
      case "partners": return <PartnersScreen />;
      case "map": return <ScreensMapScreen />;
      case "content": return <ContentScreen />;
      case "referrals": return <ReferralsScreen />;
      case "payouts": return <PayoutsScreen />;
      case "importCsv": return <ImportCsvScreen />;
      case "templates": return <SalesTemplatesScreen />;
      case "products": return <ProductsScreen />;
      case "settings": return <SettingsScreen />;
      case "notifications": return <NotificationsScreen />;
      default: return <AdvertisersScreen />;
    }
  };

  return (
    <AdminLayout currentPage={page} onPageChange={setPage}>
      {renderPage()}
    </AdminLayout>
  );
};

export default AdminDashboard;
