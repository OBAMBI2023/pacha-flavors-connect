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

// ---------------------------------------------------------------------------
// Dashboard-facing reads. RLS (orders_select_members / order_items_select_members
// / order_status_history_select_members) is the actual security boundary here;
// these queries are always additionally scoped by restaurant_id as
// defense-in-depth and to keep query plans tenant-scoped.
// ---------------------------------------------------------------------------

export type Order = {
  id: string;
  restaurant_id: string;
  order_number: number;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
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
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
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
    .select("*")
    .eq("restaurant_id", restaurantId)
    .or(`status.not.in.(${TERMINAL_STATUSES.join(",")}),created_at.gt.${since}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Order[];
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
