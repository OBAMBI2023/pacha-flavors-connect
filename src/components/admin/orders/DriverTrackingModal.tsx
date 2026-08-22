import { lazy, Suspense, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDriverLiveLocation } from "@/hooks/useDriverLiveLocation";
import { fetchRestaurantCoordinates } from "@/lib/delivery";
import type { Order } from "@/lib/orders-db";
import { DRIVER_DELIVERY_STATUS_LABELS } from "./orderStatusMeta";

// maplibre-gl is a large dependency (~1MB) -- code-split so it's only ever
// fetched the first time a tenant actually opens the tracking modal, not
// bundled into the main admin chunk unconditionally.
const DriverTrackingMap = lazy(() => import("./DriverTrackingMap").then((m) => ({ default: m.DriverTrackingMap })));

const CONNECTION_META: Record<string, { label: string; dot: string }> = {
  connecting: { label: "Connexion...", dot: "bg-amber-500 animate-pulse" },
  connected: { label: "🟢 Position en temps réel", dot: "bg-emerald-500" },
  disconnected: { label: "⚠️ Connexion temps réel interrompue", dot: "bg-muted-foreground/60" },
  error: { label: "⚠️ Connexion temps réel interrompue", dot: "bg-destructive animate-pulse" },
};

/** driver_delivery_status values reached before the driver has picked up the order -- destination is still the restaurant. */
const PRE_COLLECTION_STATUSES = new Set(["assigned", "going_to_pickup", "arrived_at_restaurant", "collecting"]);

function relativeTime(iso: string | null): string {
  if (!iso) return "jamais";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}

export function DriverTrackingModal({
  order,
  driverName,
  freshnessMinutes,
  onClose,
}: {
  order: Order | null;
  driverName: string | null;
  freshnessMinutes: number;
  onClose: () => void;
}) {
  const driverId = order?.assigned_driver_id ?? null;
  const { position, lastLocationAt, connectionStatus, loading } = useDriverLiveLocation(driverId);
  const [restaurantPosition, setRestaurantPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!order?.restaurant_id) {
      setRestaurantPosition(null);
      return;
    }
    let cancelled = false;
    void fetchRestaurantCoordinates(order.restaurant_id).then((coords) => {
      if (!cancelled) setRestaurantPosition(coords);
    });
    return () => {
      cancelled = true;
    };
  }, [order?.restaurant_id]);

  const status = order?.driver_delivery_status ?? "assigned";
  const showRestaurantAsDestination = PRE_COLLECTION_STATUSES.has(status);
  const isDelivered = order?.status === "delivered";

  const staleness =
    !isDelivered && lastLocationAt && Date.now() - new Date(lastLocationAt).getTime() > freshnessMinutes * 60_000;

  const connection = CONNECTION_META[connectionStatus] ?? CONNECTION_META["connecting"]!;

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Suivi du livreur</DialogTitle>
          <DialogDescription>
            {order ? `Commande #${order.order_number}` : ""}
            {driverName ? ` · ${driverName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isDelivered ? (
          <p className="rounded-2xl border border-border bg-muted/40 py-10 text-center text-sm text-muted-foreground">
            ✓ Livraison terminée -- le suivi n'est plus disponible.
          </p>
        ) : (
          <div className="space-y-4">
            <Suspense
              fallback={
                <div className="flex h-[360px] w-full items-center justify-center rounded-2xl border border-border bg-muted/30 text-sm text-muted-foreground sm:h-[440px]">
                  Chargement de la carte...
                </div>
              }
            >
              <DriverTrackingMap
                driverPosition={position}
                restaurantPosition={restaurantPosition}
                showRestaurantAsDestination={showRestaurantAsDestination}
              />
            </Suspense>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${connection.dot}`} />
                <span>{loading ? "Connexion..." : connection.label}</span>
              </div>
              <p className="text-muted-foreground">
                Statut : <span className="font-medium text-foreground">{DRIVER_DELIVERY_STATUS_LABELS[status]}</span>
              </p>
              <p className="text-muted-foreground">
                Destination : <span className="font-medium text-foreground">{showRestaurantAsDestination ? "Restaurant" : "Client"}</span>
              </p>
              <p className="text-muted-foreground">Dernière position : {relativeTime(lastLocationAt)}</p>
            </div>

            {staleness && (
              <p className="rounded-xl border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠️ Position non actualisée depuis plus de {freshnessMinutes} min -- peut-être obsolète.
              </p>
            )}

            {!showRestaurantAsDestination && (
              <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Position du client non disponible -- l'adresse n'est pas géolocalisée.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
