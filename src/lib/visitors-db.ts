import { supabase } from "@/integrations/supabase/client";

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
