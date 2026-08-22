import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { advanceDeliveryStatus, type DriverActiveDelivery, type DriverDeliveryStatus } from "@/lib/delivery";

/** Next step + button label for every non-terminal, non-cash-gated status. */
const NEXT_STEP: Partial<Record<DriverDeliveryStatus, { next: DriverDeliveryStatus; label: string }>> = {
  assigned: { next: "going_to_pickup", label: "Direction vers le restaurant" },
  going_to_pickup: { next: "arrived_at_restaurant", label: "Je suis arrivé au restaurant" },
  arrived_at_restaurant: { next: "collecting", label: "Récupération en cours" },
  collecting: { next: "collected", label: "Commande récupérée" },
  collected: { next: "en_route", label: "En route vers le client" },
  en_route: { next: "arrived_at_customer", label: "Je suis arrivé chez le client" },
  payment_confirmed: { next: "delivered", label: "Confirmer la livraison" },
};

/**
 * The one contextual action for the driver's current step. `arrived_at_customer`
 * is the only branching point: cash-pending orders open the encaissement
 * sheet instead of calling the RPC directly, everything else (including a
 * non-cash order reaching this same step) is a single "next status" call --
 * the RPC is the actual enforcement, this only ever offers the one legal
 * next action.
 */
export function DeliveryActionButton({
  activeDelivery,
  onAdvanced,
  onOpenCashCollection,
}: {
  activeDelivery: DriverActiveDelivery;
  onAdvanced: () => void | Promise<void>;
  onOpenCashCollection: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const current = activeDelivery.driver_delivery_status ?? "assigned";

  if (current === "delivered") return null;

  async function advance(next: DriverDeliveryStatus): Promise<boolean> {
    setBusy(true);
    try {
      await advanceDeliveryStatus(activeDelivery.order_id, next);
      await onAdvanced();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour la livraison.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (current === "arrived_at_customer") {
    const isCash = activeDelivery.payment_status === "cash_pending";
    async function startCashCollection() {
      // The confirm-payment RPC requires driver_delivery_status='cash_collection'
      // -- transition into that step before opening the sheet, not after.
      if (await advance("cash_collection")) onOpenCashCollection();
    }
    return (
      <Button className="h-12 w-full" disabled={busy} onClick={() => (isCash ? void startCashCollection() : void advance("delivered"))}>
        {isCash ? "Encaisser le paiement" : "Confirmer la livraison"}
      </Button>
    );
  }

  // The driver opened the cash sheet but closed it before confirming --
  // give them a way back in rather than stranding them on this step.
  if (current === "cash_collection") {
    return (
      <Button className="h-12 w-full" disabled={busy} onClick={onOpenCashCollection}>
        Reprendre l'encaissement
      </Button>
    );
  }

  const step = NEXT_STEP[current];
  if (!step) return null;

  return (
    <Button className="h-12 w-full" disabled={busy} onClick={() => void advance(step.next)}>
      {step.label}
    </Button>
  );
}
