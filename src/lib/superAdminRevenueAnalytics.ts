import { supabase } from "@/integrations/supabase/client";
import type { RevenueSeriesPoint } from "@/lib/orders-db";

export type SuperAdminRevenueKpis = {
  ca_total: number;
  ca_livre: number;
  orders_count: number;
  delivered_count: number;
  cancelled_count: number;
  cancellation_rate: number;
  average_order_value: number | null;
  active_clients: number;
};

export type SuperAdminTenantRankingRow = {
  restaurant_id: string;
  restaurant_name: string;
  currency: string;
  revenue: number;
  orders_count: number;
  average_order_value: number | null;
};

export type SuperAdminRevenueAnalytics = {
  period_days: number;
  kpis: SuperAdminRevenueKpis;
  revenue_series: RevenueSeriesPoint[];
  tenant_ranking: SuperAdminTenantRankingRow[];
};

const EMPTY_RESULT: SuperAdminRevenueAnalytics = {
  period_days: 30,
  kpis: {
    ca_total: 0,
    ca_livre: 0,
    orders_count: 0,
    delivered_count: 0,
    cancelled_count: 0,
    cancellation_rate: 0,
    average_order_value: null,
    active_clients: 0,
  },
  revenue_series: [],
  tenant_ranking: [],
};

/**
 * Super Admin only, platform-wide (every tenant) -- get_super_admin_revenue_analytics()
 * re-checks is_super_admin() itself. Same status-filter rules as
 * get_restaurant_dashboard_stats (revenue = delivered only, ca_total = every
 * non-cancelled order, cancellation_rate = cancelled/total*100). Use
 * fetchDashboardStats(start, end, restaurantId) instead for a single-tenant
 * drill-down -- that RPC already supports a Super Admin override.
 */
export async function fetchSuperAdminRevenueAnalytics(periodDays = 30): Promise<SuperAdminRevenueAnalytics> {
  const { data, error } = await supabase.rpc("get_super_admin_revenue_analytics", { p_period_days: periodDays });
  if (error) throw error;
  return (data as unknown as SuperAdminRevenueAnalytics | null) ?? EMPTY_RESULT;
}
