import { supabase } from "@/integrations/supabase/client";
import type { DeliveryDispatchStatus, DriverDeliveryStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/orders-db";

export type SuperAdminOrderRow = {
  id: string;
  order_number: number;
  restaurant_id: string;
  restaurant_name: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  currency: string;
  customer_name: string;
  created_at: string;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  delivery_dispatch_status: DeliveryDispatchStatus;
  driver_delivery_status: DriverDeliveryStatus | null;
};

export type SuperAdminOrdersKpis = {
  today: number;
  in_progress: number;
  delivered: number;
  cancelled: number;
  revenue: number;
};

export type SuperAdminOrdersResult = {
  orders: SuperAdminOrderRow[];
  total_count: number;
  page: number;
  page_size: number;
  kpis: SuperAdminOrdersKpis;
};

export type SuperAdminOrdersFilters = {
  restaurantId?: string | null;
  status?: OrderStatus | null;
  periodDays?: number | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
};

const EMPTY_RESULT: SuperAdminOrdersResult = {
  orders: [],
  total_count: 0,
  page: 0,
  page_size: 50,
  kpis: { today: 0, in_progress: 0, delivered: 0, cancelled: 0, revenue: 0 },
};

/**
 * Super Admin only -- get_super_admin_orders() re-checks is_super_admin()
 * itself and is never a substitute for RLS; this client call is never the
 * real security boundary. Every filter is applied server-side, and the
 * server caps page_size at 100, so this never pulls the platform's full
 * order history into the browser.
 */
export async function fetchSuperAdminOrders(filters: SuperAdminOrdersFilters = {}): Promise<SuperAdminOrdersResult> {
  const { data, error } = await supabase.rpc("get_super_admin_orders", {
    p_restaurant_id: filters.restaurantId ?? null,
    p_status: filters.status ?? null,
    p_period_days: filters.periodDays ?? null,
    p_search: filters.search?.trim() || null,
    p_page: filters.page ?? 0,
    p_page_size: filters.pageSize ?? 50,
  } as never);
  if (error) throw error;
  return (data as unknown as SuperAdminOrdersResult | null) ?? EMPTY_RESULT;
}
