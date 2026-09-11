import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MetaPixelSettings = {
  meta_pixel_id: string | null;
  meta_pixel_enabled: boolean;
  updated_at: string;
};

const PIXEL_ID_PATTERN = /^[0-9]{9,20}$/;

/** Trims whitespace only -- never mutates the digits themselves. */
export function normalizeMetaPixelId(value: string): string {
  return value.trim();
}

/** Mirrors the DB check constraint (restaurant_settings_meta_pixel_id_format) so the form can reject garbage before a round trip. */
export function isValidMetaPixelId(value: string): boolean {
  return PIXEL_ID_PATTERN.test(normalizeMetaPixelId(value));
}

/** "1234567890123456" -> "1234••••••••3456" -- shown after save so the tenant can confirm which pixel is configured without the full id sitting in the UI. */
export function maskMetaPixelId(id: string): string {
  if (id.length <= 8) return "•".repeat(id.length);
  return `${id.slice(0, 4)}${"•".repeat(id.length - 8)}${id.slice(-4)}`;
}

const SETTINGS_COLUMNS = "meta_pixel_id,meta_pixel_enabled,updated_at";

/** Every restaurant already has a restaurant_settings row (DB-enforced), so this is always a plain select -- never an upsert. */
export async function fetchMetaPixelSettings(restaurantId: string): Promise<MetaPixelSettings> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select(SETTINGS_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return {
    meta_pixel_id: data?.meta_pixel_id ?? null,
    meta_pixel_enabled: data?.meta_pixel_enabled ?? false,
    updated_at: data?.updated_at ?? new Date().toISOString(),
  };
}

/**
 * The DB constraints (format + "enabled requires an id") are the real
 * enforcement -- this call can still fail server-side even after client
 * validation. RLS (owner/manager only) is what actually stops a different
 * tenant from ever reaching this row.
 */
export async function updateMetaPixelSettings(
  restaurantId: string,
  values: { meta_pixel_id: string | null; meta_pixel_enabled: boolean },
): Promise<void> {
  const { error } = await supabase
    .from("restaurant_settings")
    .update({
      meta_pixel_id: values.meta_pixel_id ? normalizeMetaPixelId(values.meta_pixel_id) : null,
      meta_pixel_enabled: values.meta_pixel_enabled,
    })
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Storefront runtime -- loads/fires events for the CURRENT tenant only. Never
// reads a pixel id from anywhere but the settings object the caller passes
// in (itself sourced from get_public_menu for the tenant whose slug is in
// the URL), so it can never end up loading a different tenant's pixel.
// ---------------------------------------------------------------------------

type FbqFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push?: FbqFunction;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

let loadedPixelId: string | null = null;

/**
 * Standard Meta Pixel base code, injected once per page load. Idempotent
 * per pixel id -- calling this again with the same id (e.g. a remount) is a
 * no-op; calling it with a *different* id (should never happen within one
 * storefront session, but guarded anyway) re-inits fbq for the new id
 * without loading the external script twice.
 */
function ensurePixelLoaded(pixelId: string) {
  if (loadedPixelId === pixelId) return;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as FbqFunction;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
    window._fbq = window._fbq ?? fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  window.fbq!("init", pixelId);
  loadedPixelId = pixelId;
}

export type MetaPixelStorefrontSettings = { meta_pixel_id: string | null } | null | undefined;

/**
 * Call once from the tenant storefront's top-level component. Initializes
 * the pixel and fires PageView only when this tenant has actually enabled
 * one (get_public_menu already omits meta_pixel_id entirely for a disabled
 * or unconfigured tenant, so "id present" and "should load" are the same
 * check here). Never called from Super Admin or any other tenant's pages.
 */
export function useMetaPixel(settings: MetaPixelStorefrontSettings) {
  const pixelId = settings?.meta_pixel_id ?? null;
  useEffect(() => {
    if (!pixelId || !isValidMetaPixelId(pixelId)) return;
    ensurePixelLoaded(pixelId);
    window.fbq?.("track", "PageView");
  }, [pixelId]);
}

/** Fire-and-forget: a tracking failure or absent/disabled pixel must never affect the storefront experience. */
export function trackMetaPixelEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    window.fbq("track", eventName, params);
  } catch {
    // Ad blockers / privacy extensions commonly stub or remove fbq entirely.
  }
}

const PURCHASE_FIRED_PREFIX = "saovia.meta_purchase_fired.";

/**
 * Purchase must fire exactly once per order, even across a confirmation
 * page refresh or a re-mount from the 10s status poll -- guarded by the
 * order's own id in localStorage (survives refresh, unlike sessionStorage
 * or component state). Never fires from a bare visit to the confirmation
 * URL for an order that failed to create in the first place: the caller
 * only has an OrderRow to pass in once the order has actually loaded from
 * the database.
 */
export function firePurchaseOnce(orderId: string, value: number, currency: string) {
  if (typeof window === "undefined") return;
  const key = `${PURCHASE_FIRED_PREFIX}${orderId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage disabled -- proceed without dedup rather than never firing at all.
  }
  trackMetaPixelEvent("Purchase", { value, currency });
}

/** Hook form of firePurchaseOnce -- fires at most once per orderId for the lifetime of the mounted component, guarded further by the localStorage key above. */
export function useMetaPixelPurchase(order: { id: string; total_amount: number; currency: string } | null) {
  const firedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!order || firedRef.current === order.id) return;
    firedRef.current = order.id;
    firePurchaseOnce(order.id, order.total_amount, order.currency);
  }, [order]);
}

/**
 * Best-effort validity check for the "Tester le Pixel" button: confirms the
 * format is right and that the pixel base script can actually be reached
 * and initialized, without creating any order or other business record.
 * Throws with a user-facing message on failure.
 */
export async function testMetaPixelId(pixelId: string): Promise<void> {
  const normalized = normalizeMetaPixelId(pixelId);
  if (!isValidMetaPixelId(normalized)) {
    throw new Error("L'identifiant du Pixel doit contenir uniquement des chiffres (9 à 20 caractères).");
  }
  try {
    ensurePixelLoaded(normalized);
    window.fbq?.("trackSingle", normalized, "PageView");
  } catch {
    throw new Error("Impossible de charger le script Meta Pixel. Vérifiez votre connexion et réessayez.");
  }
}
