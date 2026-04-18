import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useAdminNotifications } from "@/hooks/useAdminData";
import { LogOut, Users, Handshake, Film, Link2, DollarSign, FileUp, Settings, Bell, Menu, Map, Megaphone, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { key: "advertisers", icon: Users },
  { key: "partners", icon: Handshake },
  { key: "map", icon: Map },
  { key: "content", icon: Film },
  { key: "referrals", icon: Link2 },
  { key: "payouts", icon: DollarSign },
  { key: "importCsv", icon: FileUp },
  { key: "templates", icon: Megaphone },
  { key: "products", icon: ShoppingBag },
  { key: "settings", icon: Settings },
  { key: "notifications", icon: Bell },
];

// Mapeo de tipo de notificación → sección del menú
const NOTIF_TYPE_TO_SECTION: Record<string, string> = {
  new_advertiser: "advertisers",
  new_partner: "partners",
  new_ad: "content",
};

const SECTION_KEYS = ["advertisers", "partners", "content", "notifications"];

const AdminLayout = ({ children, currentPage, onPageChange }: AdminLayoutProps) => {
  const { signOut } = useAuth();
  const { t } = useLang();
  const { data: notifications } = useAdminNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // lastRead por sección
  const [lastRead, setLastRead] = useState<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    SECTION_KEYS.forEach((key) => {
      result[key] = Number(localStorage.getItem(`admin-${key}-last-read`) ?? 0);
    });
    return result;
  });

  const markRead = (section: string) => {
    const now = Date.now();
    localStorage.setItem(`admin-${section}-last-read`, now.toString());
    setLastRead((prev) => ({ ...prev, [section]: now }));
  };

  // Cuenta notificaciones no leídas por sección
  const unreadCount = (section: string): number => {
    if (!notifications) return 0;
    const since = lastRead[section] ?? 0;
    return notifications.filter((n) => {
      const ts = new Date(n.created_at).getTime();
      if (ts <= since) return false;
      const mapped = NOTIF_TYPE_TO_SECTION[n.type] ?? "notifications";
      return mapped === section;
    }).length;
  };

  const labels: Record<string, string> = {
    advertisers: t.adminDashboard.advertisers,
    partners: t.adminDashboard.partners,
    map: "Mapa",
    content: t.adminDashboard.content,
    referrals: t.adminDashboard.referrals,
    payouts: t.adminDashboard.payouts,
    importCsv: t.adminDashboard.importCsv,
    templates: "Plantillas de Venta",
    products: "Productos Shopify",
    settings: t.adminDashboard.settings,
    notifications: t.adminDashboard.notifications,
  };

  const SidebarNav = () => (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const count = unreadCount(item.key);
        return (
          <button
            key={item.key}
            onClick={() => {
              if (SECTION_KEYS.includes(item.key)) markRead(item.key);
              onPageChange(item.key);
              setSidebarOpen(false);
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
              currentPage === item.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span>{labels[item.key]}</span>
            {count > 0 && (
              <Badge className="ml-auto h-5 min-w-[20px] flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground">
                {count}
              </Badge>
            )}
          </button>
        );
      })}
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
            AdScreenPro <span className="text-sm font-normal text-muted-foreground ml-2">Admin</span>
          </Link>
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
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
