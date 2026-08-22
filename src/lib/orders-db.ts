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

export type OrderSource = "direct" | "marketplace" | "qr_code" | "unknown";

export type PaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded" | "partially_refunded" | "cash_pending";
export type PaymentMethod = "cash" | "mobile_money" | "card" | "online" | "unknown";

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
  orderSource?: OrderSource | undefined;
  sourceMetadata?: Record<string, string> | undefined;
  paymentMethod?: PaymentMethod | undefined;
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
  order_source: OrderSource;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
};

/**
 * Creates an order via the `create_order` RPC, which re-validates every
 * product/option and recomputes all totals server-side -- the values in the
 * returned result are the authoritative ones, never the client's own cart
 * subtotal. `orderSource` is only ever a client-supplied *hint*: the RPC
 * normalizes anything outside its known allow-list to 'unknown' rather than
 * trusting it verbatim.
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
    p_order_source: input.orderSource ?? "direct",
    p_source_metadata: (input.sourceMetadata ?? {}) as unknown as Json,
    p_payment_method: input.paymentMethod ?? "cash",
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

/**
 * The only client-callable path from cash_pending -> paid. Restaurant-side
 * only (the RPC checks has_restaurant_access) -- a customer can never mark
 * their own cash order as paid.
 */
export async function markCashPaymentReceived(orderId: string): Promise<{ order_id: string; payment_status: PaymentStatus }> {
  const { data, error } = await supabase.rpc("mark_cash_payment_received", { p_order_id: orderId });
  if (error) throw error;
  return data as unknown as { order_id: string; payment_status: PaymentStatus };
}

/**
 * Refund amount is always bounded server-side by what was actually paid
 * minus what was already refunded -- this call only ever *requests* an
 * amount, the RPC decides whether it's valid.
 */
type PaymentRow = { amount: number; status: PaymentStatus };

/** Refundable remainder = sum(paid) - sum(refunded | partially_refunded), read-only hint for the UI -- the RPC is the actual authority on the bound. */
export async function fetchOrderPaymentSummary(orderId: string): Promise<{ paid: number; refunded: number; remaining: number }> {
  const { data, error } = await supabase.from("payments").select("amount,status").eq("order_id", orderId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as PaymentRow[];
  const paid = rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.amount), 0);
  const refunded = rows
    .filter((r) => r.status === "refunded" || r.status === "partially_refunded")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  return { paid, refunded, remaining: Math.max(0, paid - refunded) };
}

export async function createRefund(
  orderId: string,
  amount: number,
  reason?: string,
): Promise<{ order_id: string; payment_status: PaymentStatus; refunded_amount: number }> {
  const { data, error } = await supabase.rpc("create_refund", { p_order_id: orderId, p_amount: amount, p_reason: reason ?? null });
  if (error) throw error;
  return data as unknown as { order_id: string; payment_status: PaymentStatus; refunded_amount: number };
}

// ---------------------------------------------------------------------------
// Dashboard-facing reads. RLS (orders_select_members / order_items_select_members
// / order_status_history_select_members) is the actual security boundary here;
// these queries are always additionally scoped by restaurant_id as
// defense-in-depth and to keep query plans tenant-scoped.
// ---------------------------------------------------------------------------

export type DeliveryDispatchStatus = "not_started" | "searching" | "assigned" | "no_driver_available";
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

export type Order = {
  id: string;
  restaurant_id: string;
  order_number: number;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  assigned_driver_id: string | null;
  delivery_dispatch_status: DeliveryDispatchStatus;
  driver_delivery_status: DriverDeliveryStatus | null;
  customer_name: string;
  customer_phone: string;
  delivery_commune: string | null;
  delivery_address: string | null;
  delivery_instructions: string | null;
  customer_notes: string | null;
  currency: string;
  subtotal_amount: number;
  delivery_fee_amount: number;
  total_amount: number;
  item_count: number;
  discount_amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  paid_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  /**
   * Populated by `fetchRestaurantOrders`'s embedded select; realtime INSERT
   * payloads don't include joined rows, so `useRealtimeOrders` back-fills
   * this for orders that arrive live via `fetchOrderItemsSummary`.
   */
  items_summary?: OrderItemSummary[];
};

export type OrderItemSummary = {
  id: string;
  product_name_snapshot: string;
  quantity: number;
};

export type OrderItemOption = {
  id: string;
  option_group_name_snapshot: string;
  option_name_snapshot: string;
  extra_price_snapshot: number;
};

export type OrderItem = {
  id: string;
  product_id: string | null;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  options_price_snapshot: number;
  quantity: number;
  line_total: number;
  item_notes: string | null;
  options: OrderItemOption[];
};

export type OrderStatusHistoryEntry = {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  created_at: string;
};

export type OrderDetail = Order & {
  items: OrderItem[];
  history: OrderStatusHistoryEntry[];
};

const TERMINAL_STATUSES = ["delivered", "cancelled"] as const;

/**
 * Initial load for the orders dashboard: every order still active in the
 * pipeline (regardless of age) plus terminal orders from the last 24h, so a
 * busy restaurant never has to load its entire order history just to see
 * today's board. Realtime handles everything after this snapshot.
 */
export async function fetchRestaurantOrders(restaurantId: string): Promise<Order[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("*, items_summary:order_items(id,product_name_snapshot,quantity)")
    .eq("restaurant_id", restaurantId)
    .or(`status.not.in.(${TERMINAL_STATUSES.join(",")}),created_at.gt.${since}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

/**
 * Back-fills `items_summary` for a single order -- used when Realtime
 * delivers a bare `orders` INSERT payload (no joined rows) so the dashboard
 * card can still show product names without waiting for a full refetch.
 */
export async function fetchOrderItemsSummary(orderId: string): Promise<OrderItemSummary[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("id,product_name_snapshot,quantity")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OrderItemSummary[];
}

type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  options_price_snapshot: number;
  quantity: number;
  line_total: number;
  item_notes: string | null;
};

type OrderItemOptionRow = {
  id: string;
  order_item_id: string;
  option_group_name_snapshot: string;
  option_name_snapshot: string;
  extra_price_snapshot: number;
};

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  const [orderRes, itemsRes, historyRes] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase
      .from("order_items")
      .select("id,product_id,product_name_snapshot,unit_price_snapshot,options_price_snapshot,quantity,line_total,item_notes")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_status_history")
      .select("id,from_status,to_status,note,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  if (orderRes.error) throw orderRes.error;
  if (!orderRes.data) throw new Error("Commande introuvable");
  if (itemsRes.error) throw itemsRes.error;
  if (historyRes.error) throw historyRes.error;

  const items = (itemsRes.data ?? []) as unknown as OrderItemRow[];
  const history = (historyRes.data ?? []) as unknown as OrderStatusHistoryEntry[];

  const itemIds = items.map((row) => row.id);
  const optionsRes = itemIds.length
    ? await supabase
        .from("order_item_options")
        .select("id,order_item_id,option_group_name_snapshot,option_name_snapshot,extra_price_snapshot")
        .in("order_item_id", itemIds)
    : { data: [] as OrderItemOptionRow[], error: null };
  if (optionsRes.error) throw optionsRes.error;
  const options = (optionsRes.data ?? []) as unknown as OrderItemOptionRow[];

  const optionsByItem = new Map<string, OrderItemOption[]>();
  for (const opt of options) {
    const list = optionsByItem.get(opt.order_item_id) ?? [];
    list.push({
      id: opt.id,
      option_group_name_snapshot: opt.option_group_name_snapshot,
      option_name_snapshot: opt.option_name_snapshot,
      extra_price_snapshot: Number(opt.extra_price_snapshot),
    });
    optionsByItem.set(opt.order_item_id, list);
  }

  return {
    ...(orderRes.data as unknown as Order),
    items: items.map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_name_snapshot: row.product_name_snapshot,
      unit_price_snapshot: Number(row.unit_price_snapshot),
      options_price_snapshot: Number(row.options_price_snapshot),
      quantity: row.quantity,
      line_total: Number(row.line_total),
      item_notes: row.item_notes,
      options: optionsByItem.get(row.id) ?? [],
    })),
    history,
  };
}

// ---------------------------------------------------------------------------
// Dashboard analytics. Tenant-scoped entirely server-side by
// get_restaurant_dashboard_stats (resolves the restaurant from the
// authenticated user, exactly like update_order_status) -- the client never
// sends a restaurant_id.
// ---------------------------------------------------------------------------

export type PeriodTotals = {
  revenue: number;
  orders_count: number;
  average_order_value: number | null;
};

export type CurrentPeriodTotals = PeriodTotals & {
  delivered_count: number;
  items_sold: number;
  cancelled_orders: number;
  cancelled_amount: number;
  cancellation_rate: number;
  in_progress_revenue: number;
  total_orders: number;
  gmv: number;
  pending_collection: number;
};

export type RevenueSeriesPoint = { date: string; revenue: number; orders: number };
export type TopProduct = { name: string; quantity: number; revenue: number };
export type HourlyPoint = { hour: number; orders_count: number; revenue: number };
export type WeekdayPoint = { weekday: number; orders_count: number; revenue: number };
export type SourceBreakdownRow = {
  source: OrderSource;
  orders_count: number;
  share: number;
  revenue: number;
  average_order_value: number | null;
};
export type OperationalMetrics = {
  avg_confirmation_minutes: number | null;
  avg_preparation_minutes: number | null;
  avg_total_minutes: number | null;
};

export type PaymentBreakdownRow = { payment_status: PaymentStatus; orders_count: number; amount: number };
export type MethodBreakdownRow = { payment_method: PaymentMethod; orders_count: number; amount: number };

export type DashboardStats = {
  restaurant_id: string;
  period: { start_date: string; end_date: string };
  current: CurrentPeriodTotals;
  previous: PeriodTotals;
  revenue_series: RevenueSeriesPoint[];
  top_products: TopProduct[];
  hourly_distribution: HourlyPoint[];
  weekday_distribution: WeekdayPoint[];
  source_breakdown: SourceBreakdownRow[];
  operational_metrics: OperationalMetrics;
  payment_breakdown: PaymentBreakdownRow[];
  method_breakdown: MethodBreakdownRow[];
  collected_revenue: number;
  refunded_amount: number;
};

/**
 * Renders a Date as a plain YYYY-MM-DD using its *local* calendar fields --
 * never `toISOString()`, which normalizes to UTC and can silently shift the
 * date by a day depending on the viewer's timezone/time of day.
 */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchDashboardStats(startDate: Date, endDate: Date): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_restaurant_dashboard_stats", {
    p_start_date: toDateInputValue(startDate),
    p_end_date: toDateInputValue(endDate),
  });
  if (error) throw error;
  return data as unknown as DashboardStats;
}

// ---------------------------------------------------------------------------
// In-app notifications. RLS (notifications_select_members) scopes reads to
// the caller's own restaurant; rows are only ever written server-side by
// create_notification, called from create_order/update_order_status/the
// payment RPCs -- never inserted directly by the client.
// ---------------------------------------------------------------------------

export type AppNotification = {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  type: string;
  channel: string;
  title: string;
  body: string | null;
  metadata: Json;
  is_read: boolean;
  created_at: string;
};

export async function fetchNotifications(restaurantId: string, limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AppNotification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(restaurantId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("restaurant_id", restaurantId).eq("is_read", false);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Subscription plan (read-only foundation -- no real billing yet). Every
// restaurant is auto-enrolled on 'free' by a DB trigger; this just surfaces
// that row, it never lets a tenant change its own plan.
// ---------------------------------------------------------------------------

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_amount: number;
  currency: string;
  billing_period: string;
  features: Json;
};

export type RestaurantSubscription = {
  id: string;
  restaurant_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
};

export async function fetchRestaurantSubscription(restaurantId: string): Promise<{ subscription: RestaurantSubscription; plan: Plan } | null> {
  const { data: sub, error: subError } = await supabase
    .from("restaurant_subscriptions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (subError) throw subError;
  if (!sub) return null;
  const subscription = sub as unknown as RestaurantSubscription;
  const { data: plan, error: planError } = await supabase.from("plans").select("*").eq("id", subscription.plan_id).maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;
  return { subscription, plan: plan as unknown as Plan };
}
