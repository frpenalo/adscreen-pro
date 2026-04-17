import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAdminSettings } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { toast } from "sonner";

const SettingsScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: settings } = useAdminSettings();
  const queryClient = useQueryClient();
  const [widgetFrequency, setWidgetFrequency] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.widget_frequency) setWidgetFrequency(settings.widget_frequency);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ id: "singleton", widget_frequency: widgetFrequency }, { onConflict: "id" });
    if (error) toast.error(error.message);
    else {
      toast.success(tA.settingsSaved);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    }
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5" /> {tA.settings}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Frecuencia de widgets en el player</Label>
            <p className="text-xs text-muted-foreground">
              Muestra un widget (clima, chiste, reloj) cada N anuncios. Ejemplo: 3 = después de cada 3 anuncios.
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={20}
                value={widgetFrequency}
                onChange={(e) => setWidgetFrequency(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">anuncios entre cada widget</span>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>{tA.save}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsScreen;
