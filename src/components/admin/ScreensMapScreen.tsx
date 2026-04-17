import { useEffect, useRef, useState } from "react";
import { useAllPartners } from "@/hooks/useAdminData";
import { MapPin, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Leaflet CSS
import "leaflet/dist/leaflet.css";

interface GeocodedPartner {
  id: string;
  business_name: string;
  address: string;
  contact_name: string;
  status: string;
  lat: number;
  lng: number;
}

// Geocode a single address using Nominatim (free, no API key)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const clean = address
      .replace(/,?\s*United States$/i, "")
      .replace(/(\d{5})-\d{4}/, "$1")
      .trim();
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "Accept-Language": "es" } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // silent
  }
  return null;
}

const ScreensMapScreen = () => {
  const { data: partners, isLoading } = useAllPartners();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState<GeocodedPartner[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  // Geocode all partners (or only new ones if incremental=true)
  const geocodeAll = async (incremental = false) => {
    if (!partners || partners.length === 0) return;
    setGeocoding(true);

    const geocodedIds = new Set(geocoded.map((g) => g.id));
    const currentFailedIds = incremental ? failedIds : new Set<string>();

    // In incremental mode, only process partners not yet geocoded or failed
    const toProcess = incremental
      ? partners.filter((p) => p.address && !geocodedIds.has(p.id) &&
        (!currentFailedIds.has(p.id) || ((p as any).lat && (p as any).lng)))
      : partners.filter((p) => p.address);

    if (toProcess.length === 0) {
      setGeocoding(false);
      return;
    }

    if (!incremental) {
      setFailed([]);
      setFailedIds(new Set());
    }

    const newResults: GeocodedPartner[] = incremental ? [...geocoded] : [];
    const newFailedNames: string[] = incremental ? [...failed] : [];
    const newFailedIds: Set<string> = incremental ? new Set(failedIds) : new Set();

    for (const p of toProcess) {
      const stored = (p as any).lat && (p as any).lng ? { lat: (p as any).lat, lng: (p as any).lng } : null;
      const coords = stored ?? await geocodeAddress(p.address);
      if (coords) {
        newResults.push({
          id: p.id,
          business_name: p.business_name,
          address: p.address,
          contact_name: p.contact_name,
          status: p.status,
          ...coords,
        });
      } else {
        newFailedNames.push(p.business_name);
        newFailedIds.add(p.id);
      }
      if (!stored) await new Promise((r) => setTimeout(r, 1100));
    }

    setGeocoded(newResults);
    setFailed(newFailedNames);
    setFailedIds(newFailedIds);
    setGeocoding(false);
  };

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      // Fix default marker icon paths broken by bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [40.7128, -74.006], // Default: NYC area
        zoom: 11,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Add markers when geocoded data changes
  useEffect(() => {
    if (!mapInstanceRef.current || geocoded.length === 0) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;

      // Clear existing markers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });

      const bounds: [number, number][] = [];

      geocoded.forEach((p) => {
        const isApproved = p.status === "approved";

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 36px; height: 36px;
              background: ${isApproved ? "#2563eb" : "#f59e0b"};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.35);
              display: flex; align-items: center; justify-content: center;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        const marker = L.marker([p.lat, p.lng], { icon });

        marker.bindPopup(`
          <div style="min-width: 180px; font-family: system-ui, sans-serif;">
            <p style="font-weight: 700; font-size: 14px; margin: 0 0 4px;">${p.business_name}</p>
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px;">${p.address}</p>
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px;">Contacto: ${p.contact_name}</p>
            <span style="
              font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
              background: ${isApproved ? "#dcfce7" : "#fef3c7"};
              color: ${isApproved ? "#166534" : "#92400e"};
            ">${isApproved ? "Aprobado" : "Pendiente"}</span>
          </div>
        `);

        marker.addTo(map);
        bounds.push([p.lat, p.lng]);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    });
  }, [geocoded]);

  // Auto-geocode when partners load or when new partners appear
  useEffect(() => {
    if (!partners || partners.length === 0 || geocoding) return;
    const geocodedIds = new Set(geocoded.map((g) => g.id));
    const hasNew = partners.some(
      (p) => p.address && !geocodedIds.has(p.id) &&
      (!failedIds.has(p.id) || ((p as any).lat && (p as any).lng))
    );
    if (hasNew) {
      geocodeAll(geocoded.length > 0);
    }
  }, [partners]);

  const approvedCount = geocoded.filter((p) => p.status === "approved").length;
  const pendingCount = geocoded.filter((p) => p.status !== "approved").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Mapa de pantallas
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {partners?.length ?? 0} ubicaciones registradas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {geocoded.length > 0 && (
            <>
              <Badge className="bg-blue-100 text-blue-800 gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                {approvedCount} aprobada{approvedCount !== 1 ? "s" : ""}
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
                {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
              </Badge>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={geocodeAll}
            disabled={geocoding || isLoading}
            className="gap-2"
          >
            {geocoding
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            {geocoding ? "Localizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {(isLoading || geocoding) && geocoded.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isLoading ? "Cargando partners..." : "Geocodificando direcciones..."}
        </div>
      )}

      {/* Failed geocodes */}
      {failed.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800">
          ⚠️ No se pudo ubicar: {failed.join(", ")} — verifica que la dirección esté completa.
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full rounded-xl border border-border overflow-hidden"
        style={{ height: "520px", zIndex: 0, position: "relative" }}
      />

      {/* Partners list below map */}
      {geocoded.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {geocoded.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-card p-3 flex items-start gap-3 cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([p.lat, p.lng], 15);
                  // Open popup
                  mapInstanceRef.current.eachLayer((layer: any) => {
                    if (
                      layer.getLatLng &&
                      layer.getLatLng().lat === p.lat &&
                      layer.getLatLng().lng === p.lng
                    ) {
                      layer.openPopup();
                    }
                  });
                }
              }}
            >
              <div
                className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: p.status === "approved" ? "#2563eb" : "#f59e0b" }}
              >
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.business_name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.address}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScreensMapScreen;
