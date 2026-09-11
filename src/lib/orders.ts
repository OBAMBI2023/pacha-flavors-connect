import { supabase } from "@/integrations/supabase/client";
import type { MenuItem } from "@/data/menu";

export type FulfillmentType = "delivery" | "pickup";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type DriverDeliveryStatus =
  | "assigned"
  | "going_to_pickup"
  | "arrived_at_restaurant"
  | "collecting"
  | "collected"
  | "en_route"
  | "arrived_at_customer"
  | "cash_collection"
  | "payment_confirmed"
  | "delivered";

export type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_instructions: string | null;
  estimated_preparation_minutes: number | null;
  currency: string;
  subtotal_amount: number;
  delivery_fee_amount: number;
  discount_amount: number;
  total_amount: number;
  created_at: string;
  driver_delivery_status: DriverDeliveryStatus | null;
  restaurant: { id: string; name: string; slug: string } | null;
  items: OrderItemRow[];
};

export type CreateOrderItem = { product_id: string; quantity: number; option_ids?: string[] };

export type CreateOrderInput = {
  restaurantSlug: string;
  fulfillment_type: FulfillmentType;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string | null;
  delivery_instructions?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_neighborhood?: string | null;
  delivery_commune?: string | null;
  delivery_city?: string | null;
  delivery_landmark?: string | null;
  customer_notes?: string | null;
  /** Defaults server-side to "cash" when omitted. Only "cash" reaches a resolvable payment_status today (mark_cash_payment_received is cash-only) -- "mobile_money" orders land in payment_status "pending" with no admin reconciliation action yet. */
  payment_method?: "cash" | "mobile_money" | "card" | "online";
  items: CreateOrderItem[];
  /** Set when checkout was reached via an offer's "Profiter de l'offre" CTA. create_order re-validates it server-side (still active, still in-window) and silently ignores it if none of the ordered items match the offer's product -- it is never trusted for pricing on its own. */
  offer_id?: string | null;
  /** This app's anonymous browser identity (see visitorTracking.ts) -- lets create_order attribute the order for client-facing lifecycle notifications (order confirmed / status changes). Optional: an order placed without one simply generates no client notifications. */
  visitor_id?: string | null;
  /** Persisted as a real column (orders.cutlery_requested) and surfaced in the admin order detail + the new_order notification -- see the cutlery_requested_column migration. */
  cutlery_requested?: boolean;
  /** True snapshot fields persisted directly on the order (not squeezed into customer_notes/delivery_instructions text) -- see the order_recipient_and_delivery_snapshot migration. */
  is_for_someone_else?: boolean;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_address?: string | null;
  recipient_city?: string | null;
  recipient_neighborhood?: string | null;
  recipient_landmark?: string | null;
  recipient_additional_info?: string | null;
  allergy_information?: string | null;
  driver_note?: string | null;
  /** The orderer's own confirmed checkout address, kept distinct from delivery_address (which becomes the recipient's address when is_for_someone_else is true) so both are preserved. */
  customer_profile_address?: string | null;
  /** Set when a promo code was applied at Checkout. create_order re-resolves and re-validates it server-side (active, in-window, visibility, usage limits) -- never trusted for the discount amount, only the code string is sent. */
  promo_code?: string | null;
  /** Set only when checking out while the restaurant is closed -- an ISO timestamp for the customer-picked future slot. create_order re-validates it server-side against get_restaurant_availability(id, this timestamp); the client's own read of availability is only ever a display hint. Omitted (not just null) for a normal immediate order. */
  scheduled_for?: string | null;
  /** "qr_code" only when this tab's most recent landing on this tenant carried ?source=qr (see hasQrAttribution) -- every other order is "direct". Attribution/analytics only, never affects pricing. */
  order_source?: "direct" | "qr_code";
};

export type CreateOrderResult = {
  order_id: string;
  order_number: number;
  status: OrderStatus;
  currency: string;
  subtotal_amount: number;
  delivery_fee_amount: number;
  discount_amount: number;
  total_amount: number;
  item_count: number;
  order_source: string;
  payment_method: string;
  payment_status: string;
  promo_code_id: string | null;
  scheduled_for: string | null;
};

/**
 * Creates the order via `create_order` (SECURITY DEFINER), which
 * re-validates every product against the live menu and recomputes all
 * totals server-side -- the client cart is only ever a display hint.
 */
export async function createRestaurantOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc("create_order", {
    p_slug: input.restaurantSlug,
    p_fulfillment_type: input.fulfillment_type,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_items: input.items,
    p_delivery_address: input.delivery_address ?? null,
    p_delivery_instructions: input.delivery_instructions ?? null,
    p_delivery_latitude: input.delivery_latitude ?? null,
    p_delivery_longitude: input.delivery_longitude ?? null,
    p_delivery_neighborhood: input.delivery_neighborhood ?? null,
    p_delivery_commune: input.delivery_commune ?? null,
    p_delivery_city: input.delivery_city ?? null,
    p_delivery_landmark: input.delivery_landmark ?? null,
    p_customer_notes: input.customer_notes ?? null,
    p_payment_method: input.payment_method ?? "cash",
    p_order_source: input.order_source ?? "direct",
    p_source_metadata: { source: "saovia-mobile" },
    p_cutlery_requested: input.cutlery_requested ?? false,
    p_offer_id: input.offer_id ?? null,
    p_visitor_id: input.visitor_id ?? null,
    p_is_for_someone_else: input.is_for_someone_else ?? false,
    p_recipient_name: input.recipient_name ?? null,
    p_recipient_phone: input.recipient_phone ?? null,
    p_recipient_address: input.recipient_address ?? null,
    p_recipient_city: input.recipient_city ?? null,
    p_recipient_neighborhood: input.recipient_neighborhood ?? null,
    p_recipient_landmark: input.recipient_landmark ?? null,
    p_recipient_additional_info: input.recipient_additional_info ?? null,
    p_allergy_information: input.allergy_information ?? null,
    p_driver_note: input.driver_note ?? null,
    p_customer_profile_address: input.customer_profile_address ?? null,
    p_promo_code: input.promo_code ?? null,
    p_scheduled_for: input.scheduled_for ?? null,
  });

  if (error) throw error;
  return data as unknown as CreateOrderResult;
}

/**
 * Customers have no auth session, so RLS on `orders` (staff-only) can't
 * scope reads for them. `get_customer_orders` / `get_customer_order` are
 * SECURITY DEFINER RPCs that manually scope every row to the phone number
 * the caller supplies -- the only identity a guest checkout has.
 */
export async function fetchCustomerOrders(params: { restaurantSlug: string; customerPhone: string }): Promise<OrderRow[]> {
  const { data, error } = await supabase.rpc("get_customer_orders", {
    p_restaurant_slug: params.restaurantSlug,
    p_customer_phone: params.customerPhone,
  });
  if (error) throw error;
  return (data as unknown as OrderRow[] | null) ?? [];
}

export async function fetchCustomerOrder(params: { orderId: string; customerPhone: string }): Promise<OrderRow | null> {
  const { data, error } = await supabase.rpc("get_customer_order", {
    p_order_id: params.orderId,
    p_customer_phone: params.customerPhone,
  });
  if (error) throw error;
  return (data as unknown as OrderRow | null) ?? null;
}

export function getOrderTrackingSteps(status: OrderStatus, fulfillmentType?: FulfillmentType) {
  const allSteps: Array<{ key: OrderStatus; label: string }> = [
    { key: "pending", label: "En attente" },
    { key: "confirmed", label: "Confirmée" },
    { key: "preparing", label: "En préparation" },
    { key: "ready", label: "Prête" },
    { key: "out_for_delivery", label: "En livraison" },
    { key: "delivered", label: "Livrée" },
  ];
  // Pickup orders never go through a delivery leg -- showing "En livraison"
  // would misrepresent a step that will never apply to this order.
  const steps = fulfillmentType === "pickup" ? allSteps.filter((step) => step.key !== "out_for_delivery") : allSteps;
  const activeIndex = steps.findIndex((step) => step.key === status);
  return steps.map((step, index) => ({
    ...step,
    active: index <= activeIndex && status !== "cancelled",
    done: index < activeIndex && status !== "cancelled",
  }));
}

const DRIVER_STEP_LABELS: Partial<Record<DriverDeliveryStatus, string>> = {
  assigned: "Livreur en route vers le restaurant",
  going_to_pickup: "Livreur en route vers le restaurant",
  arrived_at_restaurant: "Livreur arrivé au restaurant",
  collecting: "Récupération de la commande",
  collected: "Commande récupérée",
  en_route: "Livreur en route vers vous",
  arrived_at_customer: "Livreur arrivé",
  cash_collection: "Paiement en cours",
  payment_confirmed: "Paiement confirmé",
  delivered: "Commande livrée",
};

/** Customer-facing copy for the driver's current sub-step, a sibling to getOrderTrackingSteps (not folded into its fixed-shape array -- other callers depend on that shape). */
export function getDriverStepLabel(status: DriverDeliveryStatus | null): string | null {
  return status ? (DRIVER_STEP_LABELS[status] ?? null) : null;
}

export function formatOrderNumber(order: Pick<OrderRow, "order_number">) {
  return `#${order.order_number}`;
}

export function cartLinesToOrderItems(lines: Array<{ item: MenuItem; qty: number; options?: Array<{ id: string }> }>): CreateOrderItem[] {
  return lines.map((line) => ({
    product_id: line.item.id,
    quantity: line.qty,
    ...(line.options && line.options.length > 0 ? { option_ids: line.options.map((o) => o.id) } : {}),
  }));
}
