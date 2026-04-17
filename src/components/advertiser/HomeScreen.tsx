import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAdvertiserProfile, useAdvertiserAds, useAdvertiserNotifications } from "@/hooks/useAdvertiserData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Film, Clock, XCircle, CheckCircle, PlusCircle, Bell, Tv, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface HomeScreenProps {
  onPageChange?: (page: string) => void;
}

const HomeScreen = ({ onPageChange }: HomeScreenProps) => {
  const { t } = useLang();
  const { data: profile } = useAdvertiserProfile();
  const { data: ads } = useAdvertiserAds();
  const { data: notifications } = useAdvertiserNotifications(5);
  const queryClient = useQueryClient();

  const published = ads?.filter((a) => a.status === "published").length ?? 0;
  const pending = ads?.filter((a) => a.status === "draft").length ?? 0;
  const rejected = ads?.filter((a) => a.status === "rejected").length ?? 0;
  const isActive = profile?.is_active ?? false;

  // Location state
  const [location, setLocation] = useState("");
  const [useZipcode, setUseZipcode] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLocation((profile as any).location ?? "");
    setUseZipcode((profile as any).use_zipcode ?? false);
  }, [profile]);

  const handleSaveLocation = async () => {
    if (!profile) return;
    setSavingLocation(true);
    const { error } = await supabase
      .from("advertisers")
      .update({ location, use_zipcode: useZipcode } as any)
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Ubicación guardada");
      queryClient.invalidateQueries({ queryKey: ["advertiser-profile"] });
    }
    setSavingLocation(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Welcome + status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Hola, {profile?.business_name ?? ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aquí está el resumen de tu cuenta.
          </p>
        </div>
        <Badge
          variant={isActive ? "default" : "secondary"}
          className="text-sm flex items-center gap-1.5 px-3 py-1.5"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {isActive ? "Cuenta activa" : "Pendiente de activación"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Tv className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{published}</p>
              <p className="text-xs text-muted-foreground">{t.advertiserDashboard.activeAds}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pending}</p>
              <p className="text-xs text-muted-foreground">{t.advertiserDashboard.pendingAds}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{rejected}</p>
              <p className="text-xs text-muted-foreground">{t.advertiserDashboard.rejectedAds}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      {isActive && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground">¿Listo para publicar un nuevo anuncio?</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sube una foto, mejórala con IA y la publicamos en pantallas en menos de 24h.
              </p>
            </div>
            <Button
              onClick={() => onPageChange?.("create")}
              className="flex-shrink-0 gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Crear anuncio
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Location (optional) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <MapPin className="h-4 w-4" />
            Tu ubicación <span className="font-normal text-muted-foreground">(opcional)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Agrega tu ubicación para ver qué pantallas están cerca de tu negocio en el mapa de cobertura.
          </p>

          {/* Zipcode toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Usar solo código postal (privacidad)</span>
            </div>
            <button
              type="button"
              onClick={() => { setUseZipcode(!useZipcode); setLocation(""); }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                useZipcode ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                useZipcode ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </div>

          <div className="flex gap-2">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={useZipcode ? "ej. 27613, Raleigh NC" : "ej. 123 Main St, Raleigh, NC"}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={handleSaveLocation} disabled={savingLocation} className="flex-shrink-0">
              Guardar
            </Button>
          </div>
          {location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {location} · <button className="underline" onClick={() => { setLocation(""); handleSaveLocation(); }}>Eliminar</button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <Bell className="h-4 w-4" />
            {t.advertiserDashboard.recentNotifications}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications && notifications.length > 0 ? (
            <ul className="space-y-3">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t.advertiserDashboard.noNotifications}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HomeScreen;
