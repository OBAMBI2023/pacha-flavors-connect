import { supabase } from "@/integrations/supabase/client";
import type { RestaurantStatus } from "@/lib/superAdminTenants";

export const TENANT_MAP_STATUS_LABELS: Record<RestaurantStatus, string> = {
  trial: "Essai",
  active: "Actif",
  suspended: "Suspendu",
  archived: "Archivé",
};

/** Same palette as super-admin.index.tsx's tenant status badges, translated to marker colors. */
export const TENANT_MAP_STATUS_COLOR: Record<RestaurantStatus, string> = {
  trial: "#d97706",
  active: "#059669",
  suspended: "#dc2626",
  archived: "#64748b",
};

export type MappedTenant = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  lat: number;
  lng: number;
  /** Commune/ville du tenant -- null quand ni l'un ni l'autre n'est renseigné (jamais inventé). */
  zone: string | null;
  customers_count: number;
  orders_count: number;
  total_revenue: number;
  currency: string;
};

export type TenantMapKpis = {
  located: number;
  zones_covered: number;
  total_orders: number;
  total_revenue: number;
};

export type TenantZoneStat = {
  zone: string;
  tenants_count: number;
  orders_count: number;
  total_revenue: number;
};

export type TenantMapResult = {
  tenants: MappedTenant[];
  kpis: TenantMapKpis;
  zones: TenantZoneStat[];
};

const EMPTY_RESULT: TenantMapResult = {
  tenants: [],
  kpis: { located: 0, zones_covered: 0, total_orders: 0, total_revenue: 0 },
  zones: [],
};

/**
 * Super Admin only -- is_super_admin() is re-checked inside the RPC
 * regardless of what the client believes. No filters: this mode shows
 * every tenant the platform has (recentering/panning does the narrowing).
 */
export async function fetchSuperAdminTenantMap(): Promise<TenantMapResult> {
  const { data, error } = await supabase.rpc("get_super_admin_tenant_map");
  if (error) throw error;
  return (data as unknown as TenantMapResult | null) ?? EMPTY_RESULT;
}
