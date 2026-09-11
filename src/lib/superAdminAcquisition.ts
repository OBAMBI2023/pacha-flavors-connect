import { supabase } from "@/integrations/supabase/client";
import type { OrderSource, RevenueSeriesPoint } from "@/lib/orders-db";

export type SuperAdminAcquisitionKpis = {
  attributed_orders: number;
  attributed_revenue: number;
  acquired_clients: number;
  qr_orders: number;
  qr_revenue: number;
  qr_clients: number;
  qr_scans: number;
  /** null when qr_scans is 0 -- not enough data to trust a rate, never shown as 0%. */
  qr_conversion_rate: number | null;
  tenants_with_measurable_acquisition: number;
};

export type SuperAdminSourceBreakdownRow = { source: OrderSource; orders_count: number; revenue: number };

export type SuperAdminMetaPixelCoverage = {
  active_count: number;
  inactive_count: number;
  none_count: number;
  total_tenants: number;
  coverage_pct: number;
};

export type SuperAdminAcquisitionTenantRow = {
  restaurant_id: string;
  restaurant_name: string;
  currency: string;
  attributed_orders: number;
  attributed_revenue: number;
  qr_orders: number;
  qr_revenue: number;
  meta_pixel_enabled: boolean;
  meta_pixel_configured: boolean;
};

export type SuperAdminAcquisitionOverview = {
  period_days: number;
  kpis: SuperAdminAcquisitionKpis;
  source_breakdown: SuperAdminSourceBreakdownRow[];
  attributed_series: RevenueSeriesPoint[];
  qr_series: RevenueSeriesPoint[];
  meta_pixel: SuperAdminMetaPixelCoverage;
  tenant_breakdown: SuperAdminAcquisitionTenantRow[];
};

const EMPTY_RESULT: SuperAdminAcquisitionOverview = {
  period_days: 30,
  kpis: {
    attributed_orders: 0,
    attributed_revenue: 0,
    acquired_clients: 0,
    qr_orders: 0,
    qr_revenue: 0,
    qr_clients: 0,
    qr_scans: 0,
    qr_conversion_rate: null,
    tenants_with_measurable_acquisition: 0,
  },
  source_breakdown: [],
  attributed_series: [],
  qr_series: [],
  meta_pixel: { active_count: 0, inactive_count: 0, none_count: 0, total_tenants: 0, coverage_pct: 0 },
  tenant_breakdown: [],
};

/**
 * Super Admin only, platform-wide -- get_super_admin_acquisition_overview()
 * re-checks is_super_admin() itself. No second attribution system: reads
 * orders.order_source ('qr_code' is the only QR marker anywhere in this
 * schema, same one create_order/get_tenant_qr_stats already use) and
 * restaurant_settings.meta_pixel_id/meta_pixel_enabled exactly as metaPixel.ts
 * already does. There is no Meta-attributed order anywhere in this schema,
 * so this never returns a Meta order/revenue figure -- meta_pixel is a
 * configuration coverage count only, never presented as a conversion.
 */
export async function fetchSuperAdminAcquisitionOverview(periodDays = 30): Promise<SuperAdminAcquisitionOverview> {
  const { data, error } = await supabase.rpc("get_super_admin_acquisition_overview", { p_period_days: periodDays });
  if (error) throw error;
  return (data as unknown as SuperAdminAcquisitionOverview | null) ?? EMPTY_RESULT;
}
