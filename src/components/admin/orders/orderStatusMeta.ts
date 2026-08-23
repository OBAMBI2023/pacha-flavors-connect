import type { DriverDeliveryStatus, FulfillmentType, Order, OrderStatus } from "@/lib/orders-db";

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

/** Full driver_delivery_status -> label map for the tracking modal -- distinct from OrderCard's own driverStepLabel(), which is a deliberately partial subset for the card view. */
export const DRIVER_DELIVERY_STATUS_LABELS: Record<DriverDeliveryStatus, string> = {
  assigned: "Livreur assigné",
  going_to_pickup: "En route vers le restaurant",
  arrived_at_restaurant: "Arrivé au restaurant",
  collecting: "Récupération en cours",
  collected: "Commande récupérée",
  en_route: "En route vers le client",
  arrived_at_customer: "Arrivé chez le client",
  cash_collection: "Encaissement en cours",
  payment_confirmed: "Paiement confirmé",
  delivered: "Livrée",
};

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
  return type === "delivery" ? "Livraison" : "Retrait sur place";
}

/**
 * The human-readable line for the delivery address block -- combines every
 * delivery_* text field the storefront may have captured (address, quartier,
 * commune, ville), skipping whichever are null so partially-filled data
 * (e.g. an older order captured before quartier/ville existed) still reads
 * cleanly instead of showing empty commas.
 */
export function deliveryAddressLine(
  order: Pick<Order, "delivery_address" | "delivery_neighborhood" | "delivery_commune" | "delivery_city">,
): string | null {
  const parts = [order.delivery_address, order.delivery_neighborhood, order.delivery_commune, order.delivery_city].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Real Google Maps deep link built only from coordinates already stored on
 * the order -- never a fabricated or geocoded-on-the-fly address.
 */
export function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/**
 * Everything a restaurant needs to hand a delivery off to a driver or a
 * third-party delivery app, as one plain-text block -- built only from
 * fields already snapshotted on the order, never re-derived or guessed.
 */
export function buildDeliveryDetailsText(
  order: Pick<
    Order,
    | "customer_name"
    | "customer_phone"
    | "delivery_address"
    | "delivery_neighborhood"
    | "delivery_commune"
    | "delivery_city"
    | "delivery_landmark"
    | "delivery_instructions"
    | "delivery_latitude"
    | "delivery_longitude"
  >,
): string {
  const lines: string[] = [];
  lines.push(`Client : ${order.customer_name}`);
  if (order.customer_phone) lines.push(`Téléphone : ${order.customer_phone}`);
  const addressLine = deliveryAddressLine(order);
  if (addressLine) lines.push(`Adresse : ${addressLine}`);
  if (order.delivery_landmark) lines.push(`Point de repère : ${order.delivery_landmark}`);
  if (order.delivery_instructions) lines.push(`Instructions : ${order.delivery_instructions}`);
  if (order.delivery_latitude !== null && order.delivery_longitude !== null) {
    lines.push(`GPS : ${order.delivery_latitude.toFixed(5)}, ${order.delivery_longitude.toFixed(5)}`);
    lines.push(`Google Maps : ${googleMapsUrl(order.delivery_latitude, order.delivery_longitude)}`);
  }
  return lines.join("\n");
}

export function elapsedLabel(fromIso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours} h ${rem} min` : `${hours} h`;
}
