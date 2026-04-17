import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { usePartnerProfile } from "@/hooks/usePartnerData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserCircle, Monitor } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { toast } from "sonner";

const ProfileScreen = () => {
  const { t } = useLang();
  const tP = t.partnerDashboard;
  const { data: profile } = usePartnerProfile();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [addressLat, setAddressLat] = useState<number | undefined>();
  const [addressLng, setAddressLng] = useState<number | undefined>();
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [payoutZelle, setPayoutZelle] = useState("");

  useEffect(() => {
    if (!profile) return;
    setBusinessName(profile.business_name);
    setAddress(profile.address);
    setContactName(profile.contact_name);
    setContactPhone(profile.contact_phone ?? "");
    setPayoutZelle(profile.payout_zelle ?? "");
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const updates: Record<string, any> = { business_name: businessName, address, contact_name: contactName, contact_phone: contactPhone, payout_zelle: payoutZelle };
    if (addressLat !== undefined) updates.lat = addressLat;
    if (addressLng !== undefined) updates.lng = addressLng;
    const { error } = await supabase
      .from("partners")
      .update(updates)
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else {
      toast.success(tP.profileSaved);
      queryClient.invalidateQueries({ queryKey: ["partner-profile"] });
    }
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-5 w-5" /> {tP.profile}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.auth.businessName}</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tP.address}</Label>
            <AddressAutocomplete
              value={address}
              onChange={(val, lat, lng) => { setAddress(val); setAddressLat(lat); setAddressLng(lng); }}
              placeholder="Ej: 123 Main St, Raleigh, NC"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label>{tP.contactName}</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tP.contactPhone}</Label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tP.payoutZelle}</Label>
            <Input value={payoutZelle} onChange={(e) => setPayoutZelle(e.target.value)} placeholder="email@example.com" />
          </div>
          <Button onClick={handleSave} disabled={saving}>{tP.save}</Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-5 w-5" /> ID de pantalla
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Usa este ID para configurar el player en tu TV.</p>
          <code className="block bg-muted rounded px-3 py-2 text-sm font-mono break-all select-all">
            {profile?.id ?? "—"}
          </code>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileScreen;
