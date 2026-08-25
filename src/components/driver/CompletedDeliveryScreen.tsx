import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CompletedDeliverySummary = {
  order_number: number;
  restaurant_name: string;
  delivery_distance_km: number | null;
};

/**
 * Shown right after `driver_advance_delivery_status` moves an order to
 * 'delivered' (captured in livreur.tsx from the real activeDelivery payload
 * just before it disappears from get_driver_active_delivery()). No earnings
 * figure is shown -- there is no driver-commission column anywhere in this
 * schema, and orders.total_amount is what the customer paid, not what the
 * driver keeps, so showing it here as "gains" would be fabricated data
 * (same rule as EarningsCard). Duration is omitted for the same reason: the
 * curated delivery payload carries no assignment/start timestamp to compute
 * one from honestly.
 */
export function CompletedDeliveryScreen({ delivery, onDone }: { delivery: CompletedDeliverySummary; onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl bg-card p-8 text-center shadow-sm">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-[#22A447]/10 text-[#22A447]">
        <PartyPopper className="h-7 w-7" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-semibold">Livraison terminée !</h1>
        <p className="mt-1 text-sm text-muted-foreground">Commande #{delivery.order_number} · {delivery.restaurant_name}</p>
      </div>
      {delivery.delivery_distance_km !== null && (
        <p className="text-xs text-muted-foreground">Distance parcourue : {delivery.delivery_distance_km.toFixed(2)} km</p>
      )}
      <div className="w-full rounded-2xl bg-secondary p-4">
        <p className="text-xs text-muted-foreground">Gains de cette course</p>
        <p className="mt-1 font-display text-xl font-bold text-foreground">--</p>
        <p className="mt-1 text-[0.65rem] text-muted-foreground">Le suivi des gains n'est pas encore disponible.</p>
      </div>
      <Button className="h-12 w-full" onClick={onDone}>
        Retour à l'accueil
      </Button>
    </div>
  );
}
