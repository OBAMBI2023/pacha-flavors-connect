import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DRIVER_ACCOUNT_STATUS_CLASSNAMES,
  DRIVER_STATUS_BUCKET_CLASSNAMES,
  DRIVER_STATUS_BUCKET_LABELS,
  driverAccountStatusLabel,
  fetchDriverIdsWithExpiredDocuments,
  fetchDrivers,
  fetchVehicles,
  driverStatusBucket,
  VEHICLE_TYPE_LABELS,
  type Driver,
  type DriverStatusBucket,
} from "@/lib/drivers";
import { AddDriverDialog } from "./AddDriverDialog";
import { DriverProfileSheet } from "./DriverProfileSheet";

const FILTERS: { value: DriverStatusBucket | "all" | "expired_docs"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "available", label: "Disponibles" },
  { value: "on_delivery", label: "En livraison" },
  { value: "offline", label: "Hors ligne" },
  { value: "suspended", label: "Suspendus" },
  { value: "expired_docs", label: "Documents expirés" },
];

export function DriversListPanel({ restaurantId }: { restaurantId: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicleByDriver, setVehicleByDriver] = useState<Map<string, string>>(new Map());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DriverStatusBucket | "all" | "expired_docs">("all");
  const [expiredIds, setExpiredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      if (filter === "expired_docs") {
        const ids = await fetchDriverIdsWithExpiredDocuments(restaurantId);
        setExpiredIds(ids);
        const { drivers: rows } = await fetchDrivers(restaurantId, { search, page: 0 });
        const filtered = rows.filter((d) => ids.has(d.id));
        setDrivers(filtered);
        setTotal(filtered.length);
      } else {
        const { drivers: rows, total: count } = await fetchDrivers(restaurantId, {
          search,
          bucket: filter === "all" ? "all" : filter,
          page,
        });
        setDrivers(rows);
        setTotal(count);
      }
      const vehicles = await fetchVehicles(restaurantId);
      const map = new Map<string, string>();
      for (const v of vehicles) if (v.is_active) map.set(v.driver_id, `${VEHICLE_TYPE_LABELS[v.vehicle_type]} · ${v.plate_number}`);
      setVehicleByDriver(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les livreurs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, search, filter, page]);

  const pageSize = 25;
  const pageCount = filter === "expired_docs" ? 1 : Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Livreurs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gérez vos livreurs, leurs véhicules et leurs documents.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Ajouter un livreur</Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setFilter(f.value); setPage(0); }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Rechercher par nom ou téléphone..." className="pl-9" />
      </div>

      {loading && drivers.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun livreur pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {drivers.map((d) => {
            const bucket = driverStatusBucket(d.status);
            return (
              <button
                key={d.id}
                onClick={() => setDetailId(d.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left hover:bg-accent/40"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {d.full_name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{d.full_name}</p>
                    <Badge className={DRIVER_STATUS_BUCKET_CLASSNAMES[bucket]}>{DRIVER_STATUS_BUCKET_LABELS[bucket]}</Badge>
                    {d.account_status === "pending_invitation" && (
                      <Badge className={DRIVER_ACCOUNT_STATUS_CLASSNAMES[d.account_status]}>{driverAccountStatusLabel(d)}</Badge>
                    )}
                    {!d.is_active && <Badge className="bg-muted text-muted-foreground">Désactivé</Badge>}
                    {expiredIds.has(d.id) && <Badge className="bg-destructive/10 text-destructive">Document expiré</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {d.phone}{vehicleByDriver.has(d.id) ? ` · ${vehicleByDriver.get(d.id)}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Précédent</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Suivant</Button>
        </div>
      )}

      <AddDriverDialog restaurantId={restaurantId} open={addOpen} onClose={() => setAddOpen(false)} onCreated={refresh} />
      <DriverProfileSheet restaurantId={restaurantId} driverId={detailId} onClose={() => setDetailId(null)} onChanged={refresh} />
    </div>
  );
}
