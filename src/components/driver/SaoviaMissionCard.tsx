import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptSaoviaAssignment,
  advanceSaoviaDelivery,
  rejectSaoviaAssignment,
  type AgentAssignedDelivery,
  type SaoviaAssignmentAction,
} from "@/lib/dispatch";

const DELIVERY_ACTION_LABELS: Record<SaoviaAssignmentAction, string> = {
  confirm_pickup: "Confirmer la collecte",
  start_delivery: "Démarrer la livraison",
  confirm_delivery: "Confirmer la livraison",
};

const DELIVERY_STATUS_TO_ACTIONS: Partial<Record<AgentAssignedDelivery["delivery_status"], SaoviaAssignmentAction[]>> = {
  assigned_pickup: ["confirm_pickup"],
  pending_pickup: ["confirm_pickup"],
  assigned_delivery: ["start_delivery", "confirm_delivery"],
  ready_for_delivery: ["start_delivery", "confirm_delivery"],
  in_transit: ["confirm_delivery"],
};

export function SaoviaMissionCard({
  mission,
  onChanged,
}: {
  mission: AgentAssignedDelivery;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<"accept" | "reject" | SaoviaAssignmentAction | null>(null);

  async function refreshAfter(action: Promise<unknown>) {
    try {
      await action;
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
      await onChanged();
    }
  }

  async function handleAccept() {
    setBusy("accept");
    try {
      await acceptSaoviaAssignment(mission.assignment_id);
      toast.success("Affectation acceptée");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'accepter l'affectation.");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    try {
      await rejectSaoviaAssignment(mission.assignment_id);
      toast.success("Affectation refusée");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de refuser l'affectation.");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function handleAdvance(action: SaoviaAssignmentAction) {
    setBusy(action);
    try {
      await advanceSaoviaDelivery(mission.assignment_id, action);
      toast.success(
        action === "confirm_pickup"
          ? "Collecte confirmée"
          : action === "start_delivery"
            ? "Livraison démarrée"
            : "Livraison confirmée",
      );
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour la mission.");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  const actions: SaoviaAssignmentAction[] = mission.status === "proposed"
    ? []
    : DELIVERY_STATUS_TO_ACTIONS[mission.delivery_status] ?? [];

  return (
    <li className="space-y-2 rounded-2xl bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {mission.role === "pickup" ? "Collecte" : "Livraison"}
        </span>
        <span className="text-xs text-muted-foreground">{mission.status}</span>
      </div>
      <p className="text-sm font-semibold">Commande {mission.order_id}</p>
      <p className="text-xs text-muted-foreground">{mission.origin === "RESTAURANT" ? "Restaurant" : "Hors restaurant"}</p>
      <p className="text-xs text-muted-foreground">Collecte : {mission.pickup_name} · {mission.pickup_address}</p>
      <p className="text-xs text-muted-foreground">Livraison : {mission.destination_name} · {mission.destination_address}</p>
      <p className="text-xs text-muted-foreground">Statut livraison : {mission.delivery_status}</p>
      {mission.delivery_fee != null && <p className="text-sm font-semibold">{mission.delivery_fee.toLocaleString("fr-FR")} FCFA</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {mission.status === "proposed" && (
          <>
            <Button size="sm" variant="outline" onClick={() => void handleReject()} disabled={busy !== null}>
              {busy === "reject" ? "Refus..." : "Refuser"}
            </Button>
            <Button size="sm" onClick={() => void handleAccept()} disabled={busy !== null}>
              {busy === "accept" ? "Acceptation..." : "Accepter"}
            </Button>
          </>
        )}
        {mission.status === "accepted" &&
          actions.map((action) => (
            <Button key={action} size="sm" onClick={() => void handleAdvance(action)} disabled={busy !== null}>
              {busy === action ? "..." : DELIVERY_ACTION_LABELS[action]}
            </Button>
          ))}
      </div>
    </li>
  );
}
