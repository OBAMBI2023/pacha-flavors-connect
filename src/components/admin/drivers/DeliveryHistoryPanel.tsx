import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS } from "@/components/admin/orders/orderStatusMeta";
import { fetchDriverAssignmentHistory, fetchDrivers, type Driver, type DriverAssignmentHistoryEntry, type DriverAssignmentType } from "@/lib/drivers";
import type { OrderStatus } from "@/lib/orders-db";

export function DeliveryHistoryPanel({ restaurantId }: { restaurantId: string }) {
  const [entries, setEntries] = useState<DriverAssignmentHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<DriverAssignmentType | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrivers(restaurantId, { page: 0 }).then(({ drivers: rows }) => setDrivers(rows));
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDriverAssignmentHistory(restaurantId, {
      driverId: driverFilter === "all" ? undefined : driverFilter,
      assignmentType: typeFilter === "all" ? undefined : typeFilter,
      page,
    })
      .then(({ entries: rows, total: count }) => {
        if (cancelled) return;
        setEntries(rows);
        setTotal(count);
      })
      .catch((err: unknown) => { if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger l'historique."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [restaurantId, driverFilter, typeFilter, page]);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Historique des livraisons</h2>
        <p className="mt-1 text-sm text-muted-foreground">Chaque assignation et réassignation de livreur, automatique ou manuelle.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={driverFilter} onValueChange={(v) => { setDriverFilter(v); setPage(0); }}>
          <SelectTrigger className="w-auto min-w-[180px]"><SelectValue placeholder="Tous les livreurs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les livreurs</SelectItem>
            {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as DriverAssignmentType | "all"); setPage(0); }}>
          <SelectTrigger className="w-auto min-w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Automatique + Manuelle</SelectItem>
            <SelectItem value="automatic">Automatique</SelectItem>
            <SelectItem value="manual">Manuelle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <Truck className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucune assignation pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((e) => (
            <div key={e.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">#{e.order_number ?? "—"}</span>
                  <Badge variant="outline">{e.order_status ? (STATUS_LABELS[e.order_status as OrderStatus] ?? e.order_status) : "—"}</Badge>
                  <Badge className={e.assignment_type === "manual" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                    {e.assignment_type === "manual" ? "Manuelle" : "Automatique"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR")}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {e.customer_name ?? "Client"} · {e.previous_driver_name ? `${e.previous_driver_name} → ` : ""}{e.new_driver_name ?? "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Précédent</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Suivant</Button>
        </div>
      )}
    </div>
  );
}
