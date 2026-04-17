import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useAdvertiserProfile, useAdvertiserNotifications } from "@/hooks/useAdvertiserData";
import { LogOut, Bell, Home, PlusCircle, Film, CreditCard, HelpCircle, Map, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AdvertiserLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { key: "home", icon: Home },
  { key: "create", icon: PlusCircle },
  { key: "ads", icon: Film },
  { key: "coverage", icon: Map },
  { key: "subscription", icon: CreditCard },
  { key: "support", icon: HelpCircle },
];

const AdvertiserLayout = ({ children, currentPage, onPageChange }: AdvertiserLayoutProps) => {
  const { signOut } = useAuth();
  const { t } = useLang();
  const { data: profile } = useAdvertiserProfile();
  const { data: notifications } = useAdvertiserNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const labels: Record<string, string> = {
    home: t.advertiserDashboard.home,
    create: t.advertiserDashboard.createAd,
    ads: t.advertiserDashboard.myAds,
    coverage: "Cobertura",
    subscription: t.advertiserDashboard.subscription,
    support: t.advertiserDashboard.support,
  };

  // Unread count: notifications newer than last-read timestamp (stored in localStorage)
  const lastReadKey = `notif-last-read-${profile?.id ?? ""}`;
  const lastRead = Number(localStorage.getItem(lastReadKey) ?? 0);
  const notifCount = notifications?.filter(
    (n) => new Date(n.created_at).getTime() > lastRead
  ).length ?? 0;

  const handleOpenNotifications = () => {
    if (!showNotifications) {
      localStorage.setItem(lastReadKey, Date.now().toString());
    }
    setShowNotifications(!showNotifications);
  };

  const SidebarContent = () => (
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
      {/* Inactive account banner */}
      {profile && !profile.is_active && (
        <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 px-4 py-2.5 text-sm text-center font-medium">
          {t.advertiserDashboard.inactiveBanner}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 pt-10">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <Link to="/" className="text-lg font-bold text-foreground">
            AdScreenPro
          </Link>
          {profile && (
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile.business_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenNotifications}
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {notifCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground">
                  {notifCount}
                </Badge>
              )}
            </Button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-border font-semibold text-sm">
                  {t.advertiserDashboard.notifications}
                </div>
                {notifications && notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 border-b border-border last:border-0 text-sm">
                      <p className="text-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    {t.advertiserDashboard.noNotifications}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t.dashboard.logout}</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card flex-shrink-0">
          <SidebarContent />
        </aside>

        {/* Main content */}
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
              currentPage === item.key
                ? "text-primary"
                : "text-muted-foreground"
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

export default AdvertiserLayout;
