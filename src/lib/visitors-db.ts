import { supabase } from "@/lib/supabase-any";

export type VisitorStats = {
  today: number;
  week: number;
  month: number;
};

/**
 * Admin-only reads. Both RPCs resolve the tenant from the authenticated
 * caller's own restaurant_memberships row server-side (see
 * get_visitor_realtime_count / get_visitor_stats) -- never from a
 * client-supplied id, so a tenant_admin can only ever see their own
 * restaurant's numbers.
 */
export async function fetchVisitorRealtimeCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_visitor_realtime_count");
  if (error) throw error;
  return (data as number | null) ?? 0;
}

export async function fetchVisitorStats(): Promise<VisitorStats> {
  const { data, error } = await supabase.rpc("get_visitor_stats");
  if (error) throw error;
  return (data as unknown as VisitorStats) ?? { today: 0, week: 0, month: 0 };
}

export type TenantQrStats = {
  currency: string;
  scans_today: number;
  scans_week: number;
  scans_month: number;
  unique_visitors_month: number;
  last_scan_at: string | null;
  qr_orders_count: number;
  qr_revenue: number;
};

/**
 * Same auth.uid()-resolved tenant scoping as fetchVisitorStats -- a tenant
 * admin can only ever see their own restaurant's QR numbers. `restaurantId`
 * is an explicit override the RPC only honors for a Super Admin (checked
 * server-side via is_super_admin()); omitted, this resolves the caller's
 * own restaurant exactly as before.
 */
export async function fetchTenantQrStats(restaurantId?: string): Promise<TenantQrStats> {
  const { data, error } = await supabase.rpc("get_tenant_qr_stats", restaurantId ? { p_restaurant_id: restaurantId } : {});
  if (error) throw error;
  return data as unknown as TenantQrStats;
}
