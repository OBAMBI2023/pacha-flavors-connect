import { supabase } from "@/lib/supabase-any";

export type FulfillmentModes = { delivery_enabled: boolean; pickup_enabled: boolean };

/** Mirrors fetchManualOverride/setManualOverride's shape (src/lib/businessHours.ts) -- same table, same targeted-column pattern. */
export async function fetchFulfillmentModes(restaurantId: string): Promise<FulfillmentModes> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("delivery_enabled,pickup_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return { delivery_enabled: data?.delivery_enabled ?? true, pickup_enabled: data?.pickup_enabled ?? true };
}

/**
 * The RLS policy (settings_manage_owner_manager) and the DB check constraint
 * (restaurant_settings_at_least_one_fulfillment_mode) are the actual
 * enforcement -- this call can still fail server-side even if the caller
 * already validated "at least one enabled" client-side.
 */
export async function updateFulfillmentModes(restaurantId: string, modes: FulfillmentModes): Promise<void> {
  const { error } = await supabase.from("restaurant_settings").update(modes).eq("restaurant_id", restaurantId);
  if (error) throw error;
}

/** Active (non-terminal) order count for a given fulfillment type -- surfaced in the disable-confirmation dialog so the tenant knows if the mode is currently in use. */
export async function countActiveOrdersByFulfillmentType(restaurantId: string, fulfillmentType: "delivery" | "pickup"): Promise<number> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("fulfillment_type", fulfillmentType)
    .not("status", "in", "(delivered,cancelled)");
  if (error) throw error;
  return count ?? 0;
}
