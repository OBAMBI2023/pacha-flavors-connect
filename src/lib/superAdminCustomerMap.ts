import { supabase } from "@/integrations/supabase/client";

export type CustomerMapStatus = "active" | "to_reactivate" | "inactive";

export const CUSTOMER_MAP_STATUS_LABELS: Record<CustomerMapStatus, string> = {
  active: "Client actif",
  to_reactivate: "Client à relancer",
  inactive: "Client inactif",
};

/** Matches the badge palette already used across the tenant admin (emerald/amber/slate). */
export const CUSTOMER_MAP_STATUS_COLOR: Record<CustomerMapStatus, string> = {
  active: "#059669",
  to_reactivate: "#d97706",
  inactive: "#64748b",
};

export type MappedCustomer = {
  id: string;
  name: string;
  phone: string;
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
  /** Neighborhood/commune/city of their most recent geolocated order -- null when none of those were captured (never invented). */
  zone: string | null;
  lat: number;
  lng: number;
  status: CustomerMapStatus;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  currency: string;
};

export type CustomerMapKpis = {
  geolocated: number;
  zones_covered: number;
  total_orders: number;
  total_revenue: number;
};

export type ZoneStat = {
  zone: string;
  customers_count: number;
  orders_count: number;
  total_revenue: number;
};

export type CustomerMapResult = {
  customers: MappedCustomer[];
  kpis: CustomerMapKpis;
  zones: ZoneStat[];
};

export type CustomerMapFilters = {
  restaurantId?: string | null;
  status?: CustomerMapStatus | null;
  /** 7 or 30 -- "derniers N jours" of order activity. Omitted (not 0) means "toute période". */
  periodDays?: number | null;
  search?: string | null;
};

const EMPTY_RESULT: CustomerMapResult = {
  customers: [],
  kpis: { geolocated: 0, zones_covered: 0, total_orders: 0, total_revenue: 0 },
  zones: [],
};

/**
 * Every filter is applied server-side (see get_super_admin_customer_map) --
 * this never fetches the full cross-tenant customer set to filter it in
 * the browser. is_super_admin() is re-checked inside the RPC regardless of
 * what the client believes; this call is never the actual security
 * boundary.
 */
export async function fetchSuperAdminCustomerMap(filters: CustomerMapFilters): Promise<CustomerMapResult> {
  const { data, error } = await supabase.rpc("get_super_admin_customer_map", {
    ...(filters.restaurantId ? { p_restaurant_id: filters.restaurantId } : {}),
    ...(filters.status ? { p_status: filters.status } : {}),
    ...(filters.periodDays ? { p_period_days: filters.periodDays } : {}),
    ...(filters.search?.trim() ? { p_search: filters.search.trim() } : {}),
  });
  if (error) throw error;
  return (data as unknown as CustomerMapResult | null) ?? EMPTY_RESULT;
}
