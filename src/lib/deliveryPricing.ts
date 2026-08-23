const PRICE_PER_KM = 300;
const MAX_DELIVERY_FEE = 2000;

/** Used only when create_order can't compute a distance (no GPS on either end) -- never 0, so a customer is never shown or charged free delivery just because their position couldn't be determined. Mirrors restaurant_settings.delivery_fee_fallback's own column default. */
export const DEFAULT_DELIVERY_FEE_FALLBACK = 1500;

/** Straight-line (not road) distance -- mirrors the DB's own public.haversine_km, already used for driver matching. No routing API is wired into this app, so this is the same honest approximation used elsewhere, not a fabricated driving-distance figure. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function deliveryFeeForDistance(distanceKm: number): number {
  return Math.min(Math.round(distanceKm * PRICE_PER_KM), MAX_DELIVERY_FEE);
}

export type DistanceBasedDeliveryQuote = { distanceKm: number; fee: number };

/**
 * Live preview only -- create_order recomputes and charges this exact same
 * formula server-side from the restaurant's and the order's own stored
 * coordinates, so a tampered client value can never change what's billed.
 * Returns null when either endpoint's coordinates are unknown (tenant has
 * no GPS configured, or the customer typed their address manually without
 * a confirmed pinned location) -- callers should fall back to
 * restaurant_settings.delivery_fee_fallback (DEFAULT_DELIVERY_FEE_FALLBACK
 * if unset) in that case, exactly like the server.
 */
export function computeDistanceBasedDelivery(
  restaurantLat: number | null,
  restaurantLng: number | null,
  customerLat: number | null,
  customerLng: number | null,
): DistanceBasedDeliveryQuote | null {
  if (restaurantLat == null || restaurantLng == null || customerLat == null || customerLng == null) return null;
  const distanceKm = haversineKm(restaurantLat, restaurantLng, customerLat, customerLng);
  return { distanceKm, fee: deliveryFeeForDistance(distanceKm) };
}
