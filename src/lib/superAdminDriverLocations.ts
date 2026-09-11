import { supabase } from "@/integrations/supabase/client";
import type { DriverStatus } from "@/lib/drivers";

export type SuperAdminDriverLocation = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  full_name: string;
  status: DriverStatus;
  is_active: boolean;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  active_order_number: number | null;
};

/**
 * Super Admin only -- get_super_admin_driver_locations() re-checks
 * is_super_admin() itself; SAOVIA's own network agents (restaurant_id is
 * null for those) are excluded server-side, they have their own roster via
 * listSaoviaAgentsForDispatch. Never invents a position: last_lat/last_lng
 * pass through exactly as stored in driver_profiles.
 */
export async function fetchSuperAdminDriverLocations(restaurantId?: string | null): Promise<SuperAdminDriverLocation[]> {
  const { data, error } = await supabase.rpc("get_super_admin_driver_locations", {
    p_restaurant_id: restaurantId ?? null,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as SuperAdminDriverLocation[];
}
