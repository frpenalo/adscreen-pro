import { useLang } from "@/contexts/LangContext";
import { useAdminNotifications } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

const NotificationsScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: notifications, isLoading } = useAdminNotifications();

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="h-5 w-5" /> {tA.inbox}
        {notifications && notifications.length > 0 && (
          <Badge>{notifications.length}</Badge>
        )}
      </h2>

      {notifications?.length === 0 && (
        <p className="text-muted-foreground text-center py-12">{tA.noNotifications}</p>
      )}

      {notifications?.map((n) => (
        <Card key={n.id}>
          <CardContent className="p-4 flex items-start gap-3">
            <Badge variant="outline" className="shrink-0 mt-0.5">{n.type}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default NotificationsScreen;
