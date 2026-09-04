import { supabase } from "@/integrations/supabase/client";

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

/** Mirrors fetchFulfillmentModes -- same table, same targeted-column pattern. */
export async function fetchPreparationTimeMinutes(restaurantId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("default_prep_time_minutes")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data?.default_prep_time_minutes ?? null;
}

/**
 * Only affects new orders going forward -- `update_order_status` snapshots
 * this value onto `orders.preparation_minutes` at the moment an order is
 * accepted, and never re-reads it afterwards, so changing it here never
 * touches an order already accepted.
 */
export async function updatePreparationTimeMinutes(restaurantId: string, minutes: number): Promise<void> {
  const { error } = await supabase
    .from("restaurant_settings")
    .update({ default_prep_time_minutes: minutes })
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
}

/** Mirrors fetchPreparationTimeMinutes -- same table, same targeted-column pattern. Null means no radius configured (delivery fee then relies only on the distance-based/flat-fee logic already in place -- see @/lib/deliveryPricing). */
export async function fetchDeliveryRadiusKm(restaurantId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("delivery_radius_km")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data?.delivery_radius_km ?? null;
}

export async function updateDeliveryRadiusKm(restaurantId: string, radiusKm: number | null): Promise<void> {
  const { error } = await supabase.from("restaurant_settings").update({ delivery_radius_km: radiusKm }).eq("restaurant_id", restaurantId);
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
