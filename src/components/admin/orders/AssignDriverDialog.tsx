import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DRIVER_STATUS_BUCKET_CLASSNAMES,
  DRIVER_STATUS_BUCKET_LABELS,
  driverStatusBucket,
  fetchDrivers,
  type Driver,
} from "@/lib/drivers";
import type { Order } from "@/lib/orders-db";

/** Same shape as RejectOrderDialog/RefundDialog: the dialog itself is the confirmation step. Lists only this order's own tenant's drivers (fetchDrivers is restaurant_id-scoped); suspended/deactivated drivers are shown but not selectable, offline drivers are selectable but require an extra checkbox acknowledging it. */
export function AssignDriverDialog({
  order,
  currentDriverId,
  busy,
  onCancel,
  onConfirm,
}: {
  order: Order | null;
  currentDriverId: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (order: Order, driverId: string) => void;
}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOffline, setConfirmOffline] = useState(false);

  useEffect(() => {
    if (!order) {
      setDrivers([]);
      setSelectedId(null);
      setConfirmOffline(false);
      return;
    }
    setLoading(true);
    fetchDrivers(order.restaurant_id, { page: 0 })
      .then(({ drivers: rows }) => {
        const sorted = [...rows].sort((a, b) => {
          const rank = (d: Driver) => (driverStatusBucket(d.status) === "available" ? 0 : driverStatusBucket(d.status) === "on_delivery" ? 1 : driverStatusBucket(d.status) === "offline" ? 2 : 3);
          return rank(a) - rank(b);
        });
        setDrivers(sorted);
      })
      .finally(() => setLoading(false));
  }, [order]);

  const selected = drivers.find((d) => d.id === selectedId) ?? null;
  const selectedBucket = selected ? driverStatusBucket(selected.status) : null;
  const needsOfflineConfirm = selectedBucket === "offline";
  const canConfirm = Boolean(selected) && selected!.is_active && selected!.status !== "suspended" && (!needsOfflineConfirm || confirmOffline);

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
          setSelectedId(null);
          setConfirmOffline(false);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentDriverId ? "Changer de livreur" : "Assigner un livreur"} {order ? `-- #${order.order_number}` : ""}</DialogTitle>
          <DialogDescription>Seuls les livreurs de votre restaurant sont affichés. Le livreur choisi verra la commande apparaître immédiatement sur son application.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement des livreurs...</p>
        ) : drivers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun livreur enregistré pour ce restaurant.</p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {drivers.map((d) => {
              const bucket = driverStatusBucket(d.status);
              const disabled = !d.is_active || d.status === "suspended";
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => { setSelectedId(d.id); setConfirmOffline(false); }}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedId === d.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {d.full_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{d.full_name}</p>
                      <Badge className={DRIVER_STATUS_BUCKET_CLASSNAMES[bucket]}>{DRIVER_STATUS_BUCKET_LABELS[bucket]}</Badge>
                      {!d.is_active && <Badge className="bg-muted text-muted-foreground">Désactivé</Badge>}
                      {d.id === currentDriverId && <Badge variant="outline">Actuel</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{d.phone}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {needsOfflineConfirm && (
          <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <input type="checkbox" className="mt-0.5" checked={confirmOffline} onChange={(e) => setConfirmOffline(e.target.checked)} />
            Ce livreur est actuellement hors ligne. Je confirme vouloir lui assigner cette commande.
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Annuler</Button>
          <Button
            disabled={busy || !canConfirm}
            onClick={() => { if (order && selectedId) onConfirm(order, selectedId); }}
          >
            {busy ? "Assignation..." : currentDriverId ? "Réassigner" : "Assigner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
