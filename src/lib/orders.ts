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

export type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_instructions: string | null;
  currency: string;
  subtotal_amount: number;
  total_amount: number;
  created_at: string;
  restaurant: { id: string; name: string; slug: string } | null;
  items: OrderItemRow[];
};

export type CreateOrderItem = { product_id: string; quantity: number };

export type CreateOrderInput = {
  restaurantSlug: string;
  fulfillment_type: FulfillmentType;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string | null;
  delivery_instructions?: string | null;
  customer_notes?: string | null;
  items: CreateOrderItem[];
};

export type CreateOrderResult = {
  order_id: string;
  order_number: number;
  status: OrderStatus;
  currency: string;
  subtotal_amount: number;
  delivery_fee_amount: number;
  total_amount: number;
  item_count: number;
  order_source: string;
  payment_method: string;
  payment_status: string;
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
    p_customer_notes: input.customer_notes ?? null,
    p_order_source: "web",
    p_source_metadata: { source: "saovia-mobile" },
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

export function getOrderTrackingSteps(status: OrderStatus) {
  const steps: Array<{ key: OrderStatus; label: string }> = [
    { key: "pending", label: "En attente" },
    { key: "confirmed", label: "Confirmée" },
    { key: "preparing", label: "En préparation" },
    { key: "ready", label: "Prête" },
    { key: "out_for_delivery", label: "En livraison" },
    { key: "delivered", label: "Livrée" },
  ];
  const activeIndex = steps.findIndex((step) => step.key === status);
  return steps.map((step, index) => ({
    ...step,
    active: index <= activeIndex && status !== "cancelled",
    done: index < activeIndex && status !== "cancelled",
  }));
}

export function formatOrderNumber(order: Pick<OrderRow, "order_number">) {
  return `#${order.order_number}`;
}

export function cartLinesToOrderItems(lines: Array<{ item: MenuItem; qty: number }>): CreateOrderItem[] {
  return lines.map((line) => ({ product_id: line.item.id, quantity: line.qty }));
}
