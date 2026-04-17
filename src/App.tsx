import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LangProvider } from "@/contexts/LangContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthRedirect from "@/components/AuthRedirect";
import PlayerPage from "./pages/PlayerPage";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";
import CheckEmail from "./pages/CheckEmail";
import AdvertiserDashboard from "./pages/dashboard/AdvertiserDashboard";
import PartnerDashboard from "./pages/dashboard/PartnerDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import NotFound from "./pages/NotFound";
import AdRedirect from "./pages/AdRedirect";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/check-email" element={<CheckEmail />} />
              <Route path="/auth/redirect" element={<AuthRedirect />} />
              <Route path="/dashboard/advertiser" element={
                <ProtectedRoute allowedRole="advertiser"><AdvertiserDashboard /></ProtectedRoute>
              } />
              <Route path="/dashboard/partner" element={
                <ProtectedRoute allowedRole="partner"><PartnerDashboard /></ProtectedRoute>
              } />
              <Route path="/dashboard/admin" element={
                <ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>
              } />
              <Route path="/player" element={<PlayerPage />} />
              <Route path="/player/:screenId" element={<PlayerPage />} />
              <Route path="/r/:adId/:screenId" element={<AdRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
