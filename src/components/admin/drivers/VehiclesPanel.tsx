import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { documentStatus, DOCUMENT_STATUS_CLASSNAMES, DOCUMENT_STATUS_LABELS, fetchVehicles, setVehicleActive, VEHICLE_TYPE_LABELS, type VehicleWithDriver } from "@/lib/drivers";
import { VehicleFormDialog } from "./VehicleFormDialog";

export function VehiclesPanel({ restaurantId }: { restaurantId: string }) {
  const [vehicles, setVehicles] = useState<VehicleWithDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<VehicleWithDriver | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setVehicles(await fetchVehicles(restaurantId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les véhicules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function toggleActive(vehicleId: string, next: boolean) {
    setBusy(true);
    try {
      await setVehicleActive(vehicleId, next);
      toast.success(next ? "Véhicule activé" : "Véhicule désactivé");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Véhicules</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tous les véhicules enregistrés par vos livreurs.</p>
      </div>

      {vehicles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <Truck className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun véhicule pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {vehicles.map((v) => {
            const nearestExpiry = [v.insurance_expires_at, v.inspection_expires_at].filter(Boolean).sort()[0] ?? null;
            const status = documentStatus(nearestExpiry);
            return (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{v.driver_full_name}</p>
                    <Badge variant="outline">{VEHICLE_TYPE_LABELS[v.vehicle_type]}</Badge>
                    {!v.is_active && <Badge className="bg-muted text-muted-foreground">Inactif</Badge>}
                    <Badge className={DOCUMENT_STATUS_CLASSNAMES[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[v.make, v.model].filter(Boolean).join(" ")} · {v.plate_number}
                    {v.insurance_expires_at && ` · Assurance : ${new Date(v.insurance_expires_at).toLocaleDateString("fr-FR")}`}
                    {v.inspection_expires_at && ` · Visite technique : ${new Date(v.inspection_expires_at).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={v.is_active} disabled={busy} aria-label={v.is_active ? "Désactiver" : "Activer"} onCheckedChange={(checked) => void toggleActive(v.id, checked)} />
                  <Button variant="outline" size="icon" onClick={() => setEditTarget(v)} aria-label="Modifier"><PencilLine className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editTarget && (
        <VehicleFormDialog
          restaurantId={restaurantId}
          driverId={editTarget.driver_id}
          vehicle={editTarget}
          open={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
