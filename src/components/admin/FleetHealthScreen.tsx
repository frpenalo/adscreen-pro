import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllPartners } from "@/hooks/useAdminData";
import { Activity, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
  uptime_seconds: number | null;
  app_version: string | null;
  ads_count: number | null;
  last_command: string | null;
  last_command_at: Date | null;
}

// Format an uptime in seconds as the most-relevant unit (h/d). Used in
// the table to flag long-running TVs that haven't rebooted in a while.
function formatUptime(s: number | null): string {
  if (!s || s <= 0) return "—";
  const hrs = s / 3600;
  if (hrs < 1) return `${Math.floor(s / 60)}m`;
  if (hrs < 48) return `${hrs.toFixed(1)}h`;
  return `${Math.floor(hrs / 24)}d`;
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

    // ad_logs counts impressions last 24h (still useful metric)
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

    const countMap = new Map<string, number>();
    const impressionsLastSeenMap = new Map<string, Date>();
    for (const row of logs ?? []) {
      const locationId = row.location_id as string;
      const ts = new Date(row.created_at);
      countMap.set(locationId, (countMap.get(locationId) ?? 0) + 1);
      const prev = impressionsLastSeenMap.get(locationId);
      if (!prev || ts > prev) impressionsLastSeenMap.set(locationId, ts);
    }

    // Prefer partners.last_seen_at (explicit heartbeat every 60s)
    // Fallback to latest ad_log timestamp so old data is not lost.
    const result: ScreenHealth[] = partners.map((p) => {
      const heartbeat = (p as any).last_seen_at ? new Date((p as any).last_seen_at) : null;
      const impressionLast = impressionsLastSeenMap.get(p.id) ?? null;
      const lastSeen = heartbeat && impressionLast
        ? (heartbeat > impressionLast ? heartbeat : impressionLast)
        : heartbeat ?? impressionLast;
      const lastCmdAt = (p as any).last_command_at ? new Date((p as any).last_command_at) : null;
      return {
        id: p.id,
        business_name: p.business_name,
        status: p.status,
        last_seen: lastSeen,
        impressions_24h: countMap.get(p.id) ?? 0,
        health: p.status === "approved" ? classifyHealth(lastSeen) : "never",
        uptime_seconds: (p as any).uptime_seconds ?? null,
        app_version: (p as any).app_version ?? null,
        ads_count: (p as any).ads_count ?? null,
        last_command: (p as any).last_command ?? null,
        last_command_at: lastCmdAt,
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

  // Per-screen "command in flight" state so we can spin the button
  // until the realtime broadcast acks (or 3s timeout).
  const [sending, setSending] = useState<Record<string, boolean>>({});

  // Send a remote command to a single screen via Supabase Realtime
  // broadcast. Mirrored audit trail goes through record_screen_command
  // RPC so admins see "last reload: 2h ago" even if the broadcast was
  // never received (e.g. TV was offline at send time).
  const sendCommand = useCallback(
    async (screenId: string, cmd: "reload" | "clear-cache" | "force-fetch", label: string) => {
      setSending((s) => ({ ...s, [screenId]: true }));
      try {
        const channel = supabase.channel(`screen-commands:${screenId}`);
        await channel.subscribe();
        await channel.send({ type: "broadcast", event: "command", payload: { cmd } });
        // Tear down — we only needed the channel to send. Persisting it
        // would mean every admin click leaves a zombie subscription.
        await supabase.removeChannel(channel);
        // Audit trail (admin-only RPC, ignore failure — broadcast already went)
        supabase.rpc("record_screen_command", { screen_id: screenId, command: cmd });
        toast.success(`${label} enviado`);
      } catch (e: any) {
        toast.error(`Error al enviar ${label}: ${e?.message ?? "desconocido"}`);
      } finally {
        setSending((s) => ({ ...s, [screenId]: false }));
      }
    },
    [],
  );

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
              <TableHead>Uptime</TableHead>
              <TableHead>Versión</TableHead>
              <TableHead className="text-right">Anuncios</TableHead>
              <TableHead className="text-right">Impresiones 24h</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  No hay pantallas registradas
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const cfg = healthConfig[r.health];
                const Icon = cfg.icon;
                const isApproved = r.status === "approved";
                const canCommand = isApproved && r.health !== "never";
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
                      {r.last_command && r.last_command_at && (
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {r.last_command} {formatLastSeen(r.last_command_at)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatUptime(r.uptime_seconds)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.app_version ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.ads_count ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.impressions_24h.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canCommand || !!sending[r.id]}
                        onClick={() => sendCommand(r.id, "reload", "Reload")}
                        title={canCommand ? "Reload remoto de la pantalla" : "TV nunca se ha conectado"}
                      >
                        {sending[r.id] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5 hidden md:inline">Reload</span>
                      </Button>
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
