import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAllAdvertisers } from "@/hooks/useAdminData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AdvertisersScreen = () => {
  const { t } = useLang();
  const tA = t.adminDashboard;
  const { data: advertisers, isLoading } = useAllAdvertisers();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const filtered = advertisers?.filter((a) => {
    if (filter === "active") return a.is_active;
    if (filter === "inactive") return !a.is_active;
    return true;
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "active", "inactive"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? tA.all : f === "active" ? tA.active : tA.inactive}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tA.name}</TableHead>
              <TableHead>{tA.business}</TableHead>
              <TableHead>{tA.category}</TableHead>
              <TableHead>{tA.email}</TableHead>
              <TableHead>{tA.status}</TableHead>
              <TableHead>{tA.registeredAt}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.customer_name}</TableCell>
                <TableCell>{a.business_name}</TableCell>
                <TableCell>{a.category}</TableCell>
                <TableCell className="text-muted-foreground">{(a as any).profiles?.email}</TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "default" : "secondary"}>
                    {a.is_active ? tA.active : tA.inactive}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {a.activated_at ? new Date(a.activated_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>


    </div>
  );
};

export default AdvertisersScreen;
