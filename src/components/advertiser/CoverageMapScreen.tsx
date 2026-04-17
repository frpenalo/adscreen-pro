import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdvertiserProfile } from "@/hooks/useAdvertiserData";
import { MapPin, Loader2, Tv, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import "leaflet/dist/leaflet.css";

interface GeocodedScreen {
  id: string;
  business_name: string;
  address: string;
  lat: number;
  lng: number;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Limpiar dirección: quitar zip+4, "United States", etc.
    const clean = address
      .replace(/,?\s*United States$/i, "")
      .replace(/(\d{5})-\d{4}/, "$1")
      .trim();
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "Accept-Language": "es" } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* silent */ }
  return null;
}

const useApprovedPartners = () =>
  useQuery({
    queryKey: ["approved-partners-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, business_name, address, lat, lng")
        .eq("status", "approved");
      if (error) throw error;
      return data;
    },
  });

const CoverageMapScreen = () => {
  const { data: partners, isLoading } = useApprovedPartners();
  const { data: advertiserProfile } = useAdvertiserProfile();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState<GeocodedScreen[]>([]);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);

  const geocodeAll = async (incremental = false) => {
    if (!partners || partners.length === 0) return;
    setGeocoding(true);

    const geocodedIds = new Set(geocoded.map((g) => g.id));
    const toProcess = incremental
      ? partners.filter((p) => p.address && !geocodedIds.has(p.id) && !failedIds.has(p.id))
      : partners.filter((p) => p.address);

    if (toProcess.length === 0) { setGeocoding(false); return; }

    const newResults: GeocodedScreen[] = incremental ? [...geocoded] : [];
    const newFailedIds: Set<string> = incremental ? new Set(failedIds) : new Set();

    for (const p of toProcess) {
      // Usar coordenadas guardadas si existen, si no geocodificar
      const stored = (p as any).lat && (p as any).lng ? { lat: (p as any).lat, lng: (p as any).lng } : null;
      const coords = stored ?? await geocodeAddress(p.address);
      if (coords) {
        newResults.push({ id: p.id, business_name: p.business_name, address: p.address, ...coords });
      } else {
        newFailedIds.add(p.id);
      }
      if (!stored) await new Promise((r) => setTimeout(r, 1100)); // delay solo si se geocodificó
    }

    // Geocode advertiser's own location if provided
    const advLocation = (advertiserProfile as any)?.location;
    if (advLocation && !myCoords) {
      const coords = await geocodeAddress(advLocation);
      setMyCoords(coords);
    }

    setGeocoded(newResults);
    setFailedIds(newFailedIds);
    setGeocoding(false);
  };

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, { center: [40.7128, -74.006], zoom: 11 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // Add markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (geocoded.length === 0) {
      // Limpiar marcadores cuando se resetea
      import("leaflet").then((L) => {
        const map = mapInstanceRef.current;
        if (map) map.eachLayer((layer: any) => { if (layer instanceof L.Marker) map.removeLayer(layer); });
      });
      return;
    }

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      map.eachLayer((layer: any) => { if (layer instanceof L.Marker) map.removeLayer(layer); });

      const bounds: [number, number][] = [];

      // Advertiser's own location marker (orange star)
      if (myCoords) {
        const myIcon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 40px; height: 40px;
              background: #f97316;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 10px rgba(249,115,22,0.5);
              display: flex; align-items: center; justify-content: center;
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -22],
        });
        const myMarker = L.marker([myCoords.lat, myCoords.lng], { icon: myIcon });
        myMarker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 140px;">
            <p style="font-weight: 700; font-size: 14px; margin: 0 0 4px;">📍 Tu negocio</p>
            <span style="font-size: 11px; color: #6b7280;">Ubicación aproximada</span>
          </div>
        `);
        myMarker.addTo(map);
        bounds.push([myCoords.lat, myCoords.lng]);
      }

      geocoded.forEach((p) => {
        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 36px; height: 36px;
              background: #2563eb;
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
          <div style="min-width: 160px; font-family: system-ui, sans-serif;">
            <p style="font-weight: 700; font-size: 14px; margin: 0 0 4px;">${p.business_name}</p>
            <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #dcfce7; color: #166534;">
              Tu anuncio aparece aquí ✓
            </span>
          </div>
        `);
        marker.addTo(map);
        bounds.push([p.lat, p.lng]);
      });

      if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
    });
  }, [geocoded]);

  // Auto-geocode — detecta partners nuevos
  useEffect(() => {
    if (!partners || partners.length === 0 || geocoding) return;
    const geocodedIds = new Set(geocoded.map((g) => g.id));
    const hasNew = partners.some(
      (p) => p.address && !geocodedIds.has(p.id) && !failedIds.has(p.id)
    );
    if (hasNew) geocodeAll(geocoded.length > 0);
  }, [partners]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            Cobertura de pantallas
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {geocoding
              ? "Cargando pantallas..."
              : `Aquí aparecerán tus anuncios — ${geocoded.length} pantalla${geocoded.length !== 1 ? "s" : ""} activa${geocoded.length !== 1 ? "s" : ""} en la red.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setGeocoded([]); setFailedIds(new Set()); }}
          disabled={geocoding || isLoading}
          className="gap-2 flex-shrink-0"
        >
          {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {geocoding ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {(isLoading || geocoding) && geocoded.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isLoading ? "Cargando pantallas..." : "Cargando mapa..."}
        </div>
      )}

      {geocoded.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-blue-100 text-blue-800 gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
            {geocoded.length} pantalla{geocoded.length !== 1 ? "s" : ""}
          </Badge>
          {myCoords && (
            <Badge className="bg-orange-100 text-orange-800 gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
              Tu negocio
            </Badge>
          )}
          {!(advertiserProfile as any)?.location && (
            <span className="text-xs text-muted-foreground">
              · Agrega tu ubicación en Inicio para verte en el mapa
            </span>
          )}
        </div>
      )}

      <div
        ref={mapRef}
        className="w-full rounded-xl border border-border overflow-hidden"
        style={{ height: "480px", zIndex: 0, position: "relative" }}
      />

      {geocoded.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {geocoded.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-card p-3 flex items-center gap-3 cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([p.lat, p.lng], 15);
                  mapInstanceRef.current.eachLayer((layer: any) => {
                    if (layer.getLatLng && layer.getLatLng().lat === p.lat && layer.getLatLng().lng === p.lng) {
                      layer.openPopup();
                    }
                  });
                }
              }}
            >
              <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-600">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{p.business_name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoverageMapScreen;
