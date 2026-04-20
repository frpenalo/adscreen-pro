import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllPartners } from "@/hooks/useAdminData";
import { Activity, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Health = "online" | "warning" | "offline" | "never";

interface ScreenHealth {
  id: string;
  business_name: string;
  status: string; // partner approval status
  last_seen: Date | null;
  impressions_24h: number;
  health: Health;
}

const HEALTH_MS = {
  online: 10 * 60 * 1000, // <10 min → online
  warning: 2 * 60 * 60 * 1000, // 10 min–2h → warning
};

function classifyHealth(lastSeen: Date | null): Health {
  if (!lastSeen) return "never";
  const diff = Date.now() - lastSeen.getTime();
  if (diff <= HEALTH_MS.online) return "online";
  if (diff <= HEALTH_MS.warning) return "warning";
  return "offline";
}

function formatLastSeen(d: Date | null): string {
  if (!d) return "nunca";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

const healthConfig: Record<Health, { label: string; icon: any; className: string }> = {
  online: {
    label: "Online",
    icon: CheckCircle2,
    className: "bg-green-500/15 text-green-700 border-green-500/30",
  },
  warning: {
    label: "Lento",
    icon: AlertTriangle,
    className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  },
  offline: {
    label: "Offline",
    icon: XCircle,
    className: "bg-red-500/15 text-red-700 border-red-500/30",
  },
  never: {
    label: "Sin actividad",
    icon: XCircle,
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
};

const FleetHealthScreen = () => {
  const { data: partners, isLoading: partnersLoading } = useAllPartners();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ScreenHealth[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!partners || partners.length === 0) {
      setRows([]);
      setLastRefresh(new Date());
      return;
    }
    setLoading(true);

    const partnerIds = partners.map((p) => p.id);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Pull all ad_logs in last 24h for these screens.
    // The RLS policy "admin sees all logs" grants access.
    const { data: logs, error } = await supabase
      .from("ad_logs")
      .select("location_id, created_at")
      .gte("created_at", since24h)
      .in("location_id", partnerIds);

    if (error) {
      console.error("Fleet health: failed to load ad_logs", error);
      setLoading(false);
      return;
    }

    const lastSeenMap = new Map<string, Date>();
    const countMap = new Map<string, number>();
    for (const row of logs ?? []) {
      const locationId = row.location_id as string;
      const ts = new Date(row.created_at);
      countMap.set(locationId, (countMap.get(locationId) ?? 0) + 1);
      const prev = lastSeenMap.get(locationId);
      if (!prev || ts > prev) lastSeenMap.set(locationId, ts);
    }

    const result: ScreenHealth[] = partners.map((p) => {
      const lastSeen = lastSeenMap.get(p.id) ?? null;
      return {
        id: p.id,
        business_name: p.business_name,
        status: p.status,
        last_seen: lastSeen,
        impressions_24h: countMap.get(p.id) ?? 0,
        health: p.status === "approved" ? classifyHealth(lastSeen) : "never",
      };
    });

    // Sort: offline/warning first, then by business_name
    const healthRank: Record<Health, number> = { offline: 0, warning: 1, never: 2, online: 3 };
    result.sort((a, b) => {
      const rh = healthRank[a.health] - healthRank[b.health];
      if (rh !== 0) return rh;
      return a.business_name.localeCompare(b.business_name);
    });

    setRows(result);
    setLastRefresh(new Date());
    setLoading(false);
  }, [partners]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const approvedCount = rows.filter((r) => r.status === "approved").length;
  const onlineCount = rows.filter((r) => r.health === "online").length;
  const warningCount = rows.filter((r) => r.health === "warning").length;
  const offlineCount = rows.filter((r) => r.health === "offline").length;
  const neverCount = rows.filter((r) => r.status === "approved" && r.health === "never").length;

  if (partnersLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" /> Fleet Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estado de las pantallas basado en impresiones registradas. Verde = activo hace &lt;10 min,
            Amarillo = &lt;2h, Rojo = sin actividad reciente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Actualizado {formatLastSeen(lastRefresh)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Aprobados" value={approvedCount} tone="default" />
        <SummaryCard label="Online" value={onlineCount} tone="green" />
        <SummaryCard label="Lento" value={warningCount} tone="yellow" />
        <SummaryCard label="Offline" value={offlineCount} tone="red" />
        <SummaryCard label="Sin actividad" value={neverCount} tone="muted" />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pantalla</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última actividad</TableHead>
              <TableHead className="text-right">Impresiones 24h</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  No hay pantallas registradas
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const cfg = healthConfig[r.health];
                const Icon = cfg.icon;
                const isApproved = r.status === "approved";
                return (
                  <TableRow key={r.id} className={!isApproved ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {r.business_name}
                      {!isApproved && (
                        <span className="ml-2 text-xs text-muted-foreground">({r.status})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLastSeen(r.last_seen)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.impressions_24h.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const toneClasses: Record<string, string> = {
  default: "bg-muted/40",
  green: "bg-green-500/10 text-green-700",
  yellow: "bg-yellow-500/10 text-yellow-700",
  red: "bg-red-500/10 text-red-700",
  muted: "bg-muted/60 text-muted-foreground",
};

const SummaryCard = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className={`rounded-lg px-4 py-3 ${toneClasses[tone]}`}>
    <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
    <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
  </div>
);

export default FleetHealthScreen;
