import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { advanceDeliveryStatus, verifyPickupCode, type DriverActiveDelivery, type DriverDeliveryStatus } from "@/lib/delivery";

/**
 * Next step + button label for every non-terminal, non-cash-gated status.
 * `arrived_at_restaurant` is handled separately below (pickup-code entry
 * replaces the old "Récupération en cours" tap-through for delivery
 * orders) -- `collecting` stays here only for orders already mid-flight
 * before that feature shipped.
 */
const NEXT_STEP: Partial<Record<DriverDeliveryStatus, { next: DriverDeliveryStatus; label: string }>> = {
  assigned: { next: "going_to_pickup", label: "Direction vers le restaurant" },
  going_to_pickup: { next: "arrived_at_restaurant", label: "Je suis arrivé au restaurant" },
  collecting: { next: "collected", label: "Commande récupérée" },
  collected: { next: "en_route", label: "En route vers le client" },
  en_route: { next: "arrived_at_customer", label: "Je suis arrivé chez le client" },
  payment_confirmed: { next: "delivered", label: "Confirmer la livraison" },
};

/**
 * The restaurant-to-driver handoff check. Server-verified only (never a
 * frontend comparison) -- a wrong code resolves normally with a toast, a
 * correct one advances `driver_delivery_status` to 'collected' directly
 * (the manual "collecting" tap is skipped for this flow). Disappears once
 * `onAdvanced()` refreshes the parent and the status is no longer
 * 'arrived_at_restaurant'.
 */
function PickupCodeForm({
  orderId,
  onVerified,
}: {
  orderId: string;
  onVerified: () => void | Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (code.length !== 2) return;
    setBusy(true);
    try {
      const result = await verifyPickupCode(orderId, code);
      if (result.success) {
        toast.success(result.message);
        setCode("");
        await onVerified();
      } else {
        toast.error(result.message);
        setCode("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de vérifier le code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div>
        <p className="font-medium">Code de collecte</p>
        <p className="text-sm text-muted-foreground">Saisissez le code communiqué par le restaurant.</p>
      </div>
      <Input
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 2))}
        className="h-14 w-24 text-center text-2xl font-semibold tracking-widest"
        placeholder="00"
      />
      <Button className="h-12 w-full" disabled={busy || code.length !== 2} onClick={() => void handleConfirm()}>
        Confirmer la collecte
      </Button>
    </div>
  );
}

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

  if (current === "arrived_at_restaurant") {
    if (activeDelivery.fulfillment_type === "delivery") {
      return <PickupCodeForm orderId={activeDelivery.order_id} onVerified={onAdvanced} />;
    }
    // Non-delivery orders never get a pickup_code -- keep the old tap-through.
    return (
      <Button className="h-12 w-full" disabled={busy} onClick={() => void advance("collecting")}>
        Récupération en cours
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
