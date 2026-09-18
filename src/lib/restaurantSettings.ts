import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MENU_BUCKET, type AboutSection } from "@/lib/menu-db";

export type FulfillmentModes = { delivery_enabled: boolean; pickup_enabled: boolean };

export const ABOUT_SECTION_MAX_HIGHLIGHTS = 4;

/** Same targeted-column read as fetchFulfillmentModes -- restaurant_settings always has exactly one row per restaurant (DB-enforced), so `{}` (the column's own default) is the only "not configured yet" case, never a missing row. */
export async function fetchAboutSection(restaurantId: string): Promise<AboutSection> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("about_section")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return (data?.about_section as AboutSection | null) ?? {};
}

/**
 * Same RLS boundary as updateFulfillmentModes (settings_manage_owner_manager)
 * -- a tenant can only ever update its own restaurant's row. Highlights are
 * clamped to ABOUT_SECTION_MAX_HIGHLIGHTS here too, not just in the form UI,
 * so a direct call can never smuggle in more than the admin form allows.
 */
export async function updateAboutSection(
  restaurantId: string,
  section: AboutSection,
): Promise<void> {
  const next: AboutSection = {
    ...section,
    highlights: (section.highlights ?? []).slice(0, ABOUT_SECTION_MAX_HIGHLIGHTS),
  };
  const { error } = await supabase
    .from("restaurant_settings")
    .update({ about_section: next })
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
}

/** Same bucket/path convention as the restaurant logo/cover upload (admin.tsx's uploadRestaurantAsset) -- storage RLS scopes by the first path segment being the restaurant's own id, generic to any subpath. */
export async function uploadAboutImage(restaurantId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${restaurantId}/about/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MENU_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(MENU_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Mirrors fetchManualOverride/setManualOverride's shape (src/lib/businessHours.ts) -- same table, same targeted-column pattern. */
export async function fetchFulfillmentModes(restaurantId: string): Promise<FulfillmentModes> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("delivery_enabled,pickup_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return {
    delivery_enabled: data?.delivery_enabled ?? true,
    pickup_enabled: data?.pickup_enabled ?? true,
  };
}

/**
 * The RLS policy (settings_manage_owner_manager) and the DB check constraint
 * (restaurant_settings_at_least_one_fulfillment_mode) are the actual
 * enforcement -- this call can still fail server-side even if the caller
 * already validated "at least one enabled" client-side.
 */
export async function updateFulfillmentModes(
  restaurantId: string,
  modes: FulfillmentModes,
): Promise<void> {
  const { error } = await supabase
    .from("restaurant_settings")
    .update(modes)
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
}

/** Same targeted-column read as fetchFulfillmentModes -- restaurant_settings always has exactly one row per restaurant, so the column's own default (true) is the only "not configured yet" case. */
export async function fetchOrderNotificationsEnabled(restaurantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("order_notifications_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data?.order_notifications_enabled ?? true;
}

/** Same RLS boundary as updateFulfillmentModes (settings_manage_owner_manager). Gates the whole tenant-side "nouvelle commande" alert pipeline -- see notify_restaurant_new_order() server-side and useOrdersAlert client-side. */
export async function updateOrderNotificationsEnabled(
  restaurantId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("restaurant_settings")
    .update({ order_notifications_enabled: enabled })
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
}

/**
 * Shared React Query cache so /admin (gating RealtimeOrdersBubble and
 * useOrdersAlert's toast/sound/vibration) and the settings card (rendering +
 * toggling the switch) always agree without prop-drilling between them --
 * a successful toggle in the settings card updates this same cache entry, so
 * the bubble reacts immediately, no page refresh needed.
 */
export function useOrderNotificationsEnabled(restaurantId: string | null) {
  return useQuery({
    queryKey: ["order-notifications-enabled", restaurantId],
    queryFn: () => fetchOrderNotificationsEnabled(restaurantId as string),
    enabled: Boolean(restaurantId),
  });
}

/** Active (non-terminal) order count for a given fulfillment type -- surfaced in the disable-confirmation dialog so the tenant knows if the mode is currently in use. */
export async function countActiveOrdersByFulfillmentType(
  restaurantId: string,
  fulfillmentType: "delivery" | "pickup",
): Promise<number> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("fulfillment_type", fulfillmentType)
    .not("status", "in", "(delivered,cancelled)");
  if (error) throw error;
  return count ?? 0;
}
