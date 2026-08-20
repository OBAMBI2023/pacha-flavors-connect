import type { FulfillmentType, Order, OrderStatus } from "@/lib/orders-db";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Nouvelle",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending: "bg-primary text-primary-foreground",
  confirmed: "bg-sky-600 text-white",
  preparing: "bg-amber-500 text-white",
  ready: "bg-emerald-600 text-white",
  out_for_delivery: "bg-violet-600 text-white",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

export const FILTER_TABS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "pending", label: "Nouvelles" },
  { id: "confirmed", label: "Confirmées" },
  { id: "preparing", label: "En préparation" },
  { id: "ready", label: "Prêtes" },
  { id: "out_for_delivery", label: "En livraison" },
  { id: "delivered", label: "Livrées" },
  { id: "cancelled", label: "Annulées" },
];

export const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

export type OrderAction = {
  label: string;
  nextStatus: OrderStatus;
  variant: "default" | "destructive";
};

/**
 * Only the transition(s) valid from this exact status, mirroring the
 * server-side allow-list in `update_order_status` -- the frontend never
 * offers (and the backend never accepts) an arbitrary jump.
 */
export function nextActions(order: Pick<Order, "status" | "fulfillment_type">): OrderAction[] {
  switch (order.status) {
    case "pending":
      return [
        { label: "Accepter", nextStatus: "confirmed", variant: "default" },
        { label: "Refuser", nextStatus: "cancelled", variant: "destructive" },
      ];
    case "confirmed":
      return [{ label: "Commencer la préparation", nextStatus: "preparing", variant: "default" }];
    case "preparing":
      return [{ label: "Commande prête", nextStatus: "ready", variant: "default" }];
    case "ready":
      return order.fulfillment_type === "delivery"
        ? [{ label: "Partie en livraison", nextStatus: "out_for_delivery", variant: "default" }]
        : [{ label: "Commande remise", nextStatus: "delivered", variant: "default" }];
    case "out_for_delivery":
      return [{ label: "Marquer comme livrée", nextStatus: "delivered", variant: "default" }];
    default:
      return [];
  }
}

export function fulfillmentLabel(type: FulfillmentType): string {
  return type === "delivery" ? "Livraison" : "À emporter";
}

export function elapsedLabel(fromIso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours} h ${rem} min` : `${hours} h`;
}
