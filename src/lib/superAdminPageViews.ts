import { supabase } from "@/integrations/supabase/client";

export type SuperAdminPageViewTenantRow = {
  restaurant_id: string;
  restaurant_name: string;
  logo_url: string | null;
  views_period: number;
  unique_visitors_period: number;
  views_today: number;
  unique_visitors_today: number;
  active_visitors_now: number;
};

export type SuperAdminPageViewDayRow = {
  date: string;
  views: number;
  unique_visitors: number;
};

export type SuperAdminPageViewOverview = {
  period_days: number;
  total_views_today: number;
  unique_visitors_today: number;
  active_visitors_now: number;
  tenants: SuperAdminPageViewTenantRow[];
  views_by_day: SuperAdminPageViewDayRow[];
};

const EMPTY_RESULT: SuperAdminPageViewOverview = {
  period_days: 30,
  total_views_today: 0,
  unique_visitors_today: 0,
  active_visitors_now: 0,
  tenants: [],
  views_by_day: [],
};

/**
 * Super Admin only, platform-wide -- get_super_admin_pageview_overview() re-checks
 * is_super_admin() itself. Reuses visitor_sessions exactly as get_visitor_stats /
 * get_visitor_realtime_count already do (page_views for view counts, distinct
 * visitor_id for unique/active visitors) -- no PII, no visitor_id or session id ever
 * returned, only restaurant id/name/logo plus aggregate counts. `tenants` starts from
 * every is_public+active restaurant (LEFT JOIN), so a tenant with zero views still
 * appears with real zeros -- never dropped, never fabricated.
 */
export async function fetchSuperAdminPageViewOverview(periodDays = 30): Promise<SuperAdminPageViewOverview> {
  const { data, error } = await supabase.rpc("get_super_admin_pageview_overview", { p_period_days: periodDays });
  if (error) throw error;
  return (data as unknown as SuperAdminPageViewOverview | null) ?? EMPTY_RESULT;
}
