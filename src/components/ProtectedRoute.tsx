import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: "admin" | "partner" | "advertiser";
}

const roleHome: Record<string, string> = {
  admin: "/dashboard/admin",
  partner: "/dashboard/partner",
  advertiser: "/dashboard/advertiser",
};

const ProtectedRoute = ({ children, allowedRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role && role !== allowedRole) return <Navigate to={roleHome[role]} replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
