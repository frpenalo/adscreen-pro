import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAllPayouts } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const PayoutsScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: payouts, isLoading } = useAllPayouts();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [actionPayout, setActionPayout] = useState<{ id: string; action: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = payouts?.filter((p) => filter === "all" || p.status === filter);

  const handleAction = async () => {
    if (!actionPayout) return;
    const { id, action } = actionPayout;
    let updates: any = {};

    if (action === "approve") updates = { status: "approved" };
    else if (action === "reject") updates = { status: "rejected", rejection_reason: rejectReason || null };
    else if (action === "paid") updates = { status: "paid", paid_at: new Date().toISOString() };

    const { error } = await supabase.from("payout_requests").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else {
      const msg = action === "approve" ? tA.payoutApproved : action === "reject" ? tA.payoutRejected : tA.payoutPaid;
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
    }
    setActionPayout(null);
    setRejectReason("");
  };

  const statusVariant = (s: string) => s === "paid" ? "default" : s === "approved" ? "secondary" : s === "rejected" ? "destructive" : "outline";

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["all", "requested", "approved", "rejected", "paid"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? tA.all : f === "requested" ? tA.pending : f === "approved" ? tA.approved : f === "rejected" ? tA.rejected : tA.paid}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tA.partner}</TableHead>
              <TableHead>{tA.amount}</TableHead>
              <TableHead>{tA.status}</TableHead>
              <TableHead>{tA.requestDate}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{(p as any).partners?.business_name ?? "—"}</TableCell>
                <TableCell>${Number(p.amount_usd).toFixed(2)}</TableCell>
                <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {p.status === "requested" && (
                      <>
                        <Button size="sm" onClick={() => setActionPayout({ id: p.id, action: "approve" })}>{tA.approve}</Button>
                        <Button size="sm" variant="destructive" onClick={() => setActionPayout({ id: p.id, action: "reject" })}>{tA.reject}</Button>
                      </>
                    )}
                    {p.status === "approved" && (
                      <Button size="sm" onClick={() => setActionPayout({ id: p.id, action: "paid" })}>{tA.markAsPaid}</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!actionPayout} onOpenChange={() => { setActionPayout(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionPayout?.action === "reject" ? tA.reject : tA.confirm}</DialogTitle></DialogHeader>
          {actionPayout?.action === "reject" && (
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={tA.rejectReason} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionPayout(null)}>{tA.cancel}</Button>
            <Button onClick={handleAction} variant={actionPayout?.action === "reject" ? "destructive" : "default"}>{tA.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutsScreen;
