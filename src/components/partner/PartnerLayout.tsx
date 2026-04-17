import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { usePartnerProfile } from "@/hooks/usePartnerData";
import { LogOut, LayoutDashboard, Users, Wallet, UserCircle, HelpCircle, Menu, Tv } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface PartnerLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { key: "reports", icon: LayoutDashboard },
  { key: "ads", icon: Tv },
  { key: "referrals", icon: Users },
  { key: "payouts", icon: Wallet },
  { key: "profile", icon: UserCircle },
  { key: "support", icon: HelpCircle },
];

const PartnerLayout = ({ children, currentPage, onPageChange }: PartnerLayoutProps) => {
  const { signOut } = useAuth();
  const { t } = useLang();
  const { data: profile } = usePartnerProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const labels: Record<string, string> = {
    reports: t.partnerDashboard.reports,
    ads: "Mis Anuncios",
    referrals: t.partnerDashboard.referrals,
    payouts: t.partnerDashboard.payouts,
    profile: t.partnerDashboard.profile,
    support: t.partnerDashboard.support,
  };

  const SidebarNav = () => (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => (
        <button
          key={item.key}
          onClick={() => { onPageChange(item.key); setSidebarOpen(false); }}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            currentPage === item.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          <span>{labels[item.key]}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      <header className="border-b border-border bg-card px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 pt-10">
              <SidebarNav />
            </SheetContent>
          </Sheet>
          <Link to="/" className="text-lg font-bold text-foreground">
            AdScreenPro <span className="text-sm font-normal text-muted-foreground ml-2">Partner</span>
          </Link>
          {profile && (
            <span className="text-sm text-muted-foreground hidden sm:inline">{profile.business_name}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t.dashboard.logout}</span>
        </Button>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card flex-shrink-0">
          <SidebarNav />
        </aside>
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-2 z-30">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onPageChange(item.key)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors",
              currentPage === item.key ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate max-w-[60px]">{labels[item.key]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default PartnerLayout;
