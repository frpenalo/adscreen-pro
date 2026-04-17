import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAllEarnings, useAllPartners, useAllAdvertisers } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// FASE 2: import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// FASE 2: import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// FASE 2: import { ShoppingBag, Plus } from "lucide-react";
import { toast } from "sonner";

interface EarningRow {
  id?: string;
  partner_id: string;
  advertiser_id: string;
  month: string;
  amount_usd: number;
  partnerName?: string;
  advertiserName?: string;
  accumulated?: number;
}

const ReferralsScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: earnings } = useAllEarnings();
  const { data: partners } = useAllPartners();
  const { data: advertisers } = useAllAdvertisers();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<EarningRow[]>([]);
  const [saving, setSaving] = useState(false);

  // FASE 2: formulario para agregar comisiones de GoAffPro manualmente
  // const [commForm, setCommForm] = useState({ partner_id: "", product_name: "", sale_amount: "", commission_rate: "", order_ref: "", notes: "" });
  // const [addingComm, setAddingComm] = useState(false);
  // const handleAddCommission = async () => { ... };

  useEffect(() => {
    if (!earnings) return;
    const mapped: EarningRow[] = earnings.map((e) => ({
      id: e.id,
      partner_id: e.partner_id,
      advertiser_id: e.advertiser_id,
      month: e.month,
      amount_usd: Number(e.amount_usd),
      partnerName: (e as any).partners?.business_name,
      advertiserName: (e as any).advertisers?.business_name,
    }));

    // Calculate accumulated per partner+advertiser pair
    const accMap = new Map<string, number>();
    mapped.forEach((r) => {
      const key = `${r.partner_id}-${r.advertiser_id}`;
      accMap.set(key, (accMap.get(key) ?? 0) + r.amount_usd);
    });
    mapped.forEach((r) => {
      r.accumulated = accMap.get(`${r.partner_id}-${r.advertiser_id}`) ?? 0;
    });

    setRows(mapped);
  }, [earnings]);

  const handleAmountChange = (index: number, value: string) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, amount_usd: parseFloat(value) || 0 } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        if (row.id) {
          await supabase
            .from("partner_referral_earnings_manual")
            .update({ amount_usd: row.amount_usd })
            .eq("id", row.id);
        }
      }
      toast.success(tA.saved);
      queryClient.invalidateQueries({ queryKey: ["admin-earnings"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* FASE 2: formulario para agregar comisiones de GoAffPro */}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tA.partner}</TableHead>
              <TableHead>{tA.advertiser}</TableHead>
              <TableHead>{tA.month}</TableHead>
              <TableHead>{tA.monthlyAmount}</TableHead>
              <TableHead>{tA.accumulated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.id ?? i}>
                <TableCell className="font-medium">{row.partnerName ?? row.partner_id.slice(0, 8)}</TableCell>
                <TableCell>{row.advertiserName ?? row.advertiser_id.slice(0, 8)}</TableCell>
                <TableCell className="text-muted-foreground">{row.month}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.amount_usd}
                    onChange={(e) => handleAmountChange(i, e.target.value)}
                    className="w-28"
                    step="0.01"
                  />
                </TableCell>
                <TableCell className="font-semibold">${row.accumulated?.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">—</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Button onClick={handleSave} disabled={saving}>{tA.saveChanges}</Button>
    </div>
  );
};

export default ReferralsScreen;
