import { useState, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  rowsProcessed: number;
  attributionsFound: number;
  errors: number;
}

const ImportCsvScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"/, "").replace(/"$/, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      return obj;
    });
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setProcessing(true);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      // Create import record
      const { data: importRecord, error: importErr } = await supabase
        .from("shopify_imports")
        .insert({ uploaded_by_admin_id: user.id, notes: file.name })
        .select()
        .single();
      if (importErr) throw importErr;

      // Upload CSV to storage
      await supabase.storage
        .from("shopify-csv")
        .upload(`${importRecord.id}/${file.name}`, file, { contentType: "text/csv" });

      let attributionsFound = 0;
      let errors = 0;

      for (const row of rows) {
        const refCode = row.referral_code || row.Referral_Code || row["Discount Code"] || "";
        if (!refCode) continue;

        // Look up partner by referral code
        const { data: qr } = await supabase
          .from("partner_qr_codes")
          .select("partner_id")
          .eq("code", refCode)
          .maybeSingle();

        if (!qr) continue;

        const orderId = row.order_id || row.Order || row.Name || `row-${attributionsFound}`;
        const grossSales = parseFloat(row.gross_sales || row.Total || row.Subtotal || "0") || 0;
        const orderDate = row.order_date || row.Created_at || row["Created at"] || new Date().toISOString();

        const { error: insertErr } = await supabase
          .from("partner_sales_attribution")
          .insert({
            import_id: importRecord.id,
            partner_id: qr.partner_id,
            order_id: orderId,
            order_date: new Date(orderDate).toISOString(),
            gross_sales_usd: grossSales,
            referral_code: refCode,
            raw_row: row,
          });

        if (insertErr) errors++;
        else attributionsFound++;
      }

      setResult({ rowsProcessed: rows.length, attributionsFound, errors });
      toast.success(tA.importSummary);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-5 w-5" /> {tA.uploadCsv}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={processing} className="w-full">
            {processing ? tA.processing : tA.selectFile}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base">{tA.importSummary}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{tA.rowsProcessed}: <span className="font-semibold">{result.rowsProcessed}</span></p>
            <p className="text-sm">{tA.attributionsFound}: <span className="font-semibold">{result.attributionsFound}</span></p>
            <p className="text-sm">{tA.errors}: <span className="font-semibold">{result.errors}</span></p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportCsvScreen;
