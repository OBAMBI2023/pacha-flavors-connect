import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type FulfillmentType = "delivery" | "pickup";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type CreateOrderItemInput = {
  product_id: string;
  quantity: number;
  option_ids?: string[];
  notes?: string;
};

export type CreateOrderInput = {
  slug: string;
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  items: CreateOrderItemInput[];
  deliveryCommune?: string | undefined;
  deliveryAddress?: string | undefined;
  deliveryInstructions?: string | undefined;
  customerNotes?: string | undefined;
};

export type CreateOrderResult = {
  order_id: string;
  order_number: number;
  status: OrderStatus;
  currency: string;
  subtotal_amount: number;
  delivery_fee_amount: number;
  total_amount: number;
};

/**
 * Creates an order via the `create_order` RPC, which re-validates every
 * product/option and recomputes all totals server-side -- the values in the
 * returned result are the authoritative ones, never the client's own cart
 * subtotal.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc("create_order", {
    p_slug: input.slug,
    p_fulfillment_type: input.fulfillmentType,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_items: input.items as unknown as Json,
    p_delivery_commune: input.deliveryCommune ?? null,
    p_delivery_address: input.deliveryAddress ?? null,
    p_delivery_instructions: input.deliveryInstructions ?? null,
    p_customer_notes: input.customerNotes ?? null,
  });
  if (error) throw error;
  return data as unknown as CreateOrderResult;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  note?: string,
): Promise<{ order_id: string; status: OrderStatus }> {
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data as unknown as { order_id: string; status: OrderStatus };
}
