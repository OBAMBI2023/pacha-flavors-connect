import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-any";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";

export type OfferStatus = "draft" | "active" | "expired" | "disabled";

/** Client-facing offer as returned by get_tenant_offers -- already joined with its product and this visitor's read state. */
export type TenantOffer = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  product_id: string;
  product_name: string;
  product_image_path: string | null;
  original_price: number;
  offer_price: number;
  discount_percent: number;
  ends_at: string | null;
  is_read: boolean;
};

export async function fetchTenantOffers(slug: string, visitorId: string | null): Promise<TenantOffer[]> {
  const { data, error } = await supabase.rpc("get_tenant_offers", visitorId ? { p_slug: slug, p_visitor_id: visitorId } : { p_slug: slug });
  if (error) throw error;
  return (data as unknown as TenantOffer[] | null) ?? [];
}

export async function fetchUnreadOffersCount(slug: string, visitorId: string | null): Promise<number> {
  if (!visitorId) return 0;
  const { data, error } = await supabase.rpc("get_unread_offers_count", { p_slug: slug, p_visitor_id: visitorId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

export async function markOfferRead(offerId: string, visitorId: string | null): Promise<void> {
  if (!visitorId) return;
  const { error } = await supabase.rpc("mark_offer_read", { p_offer_id: offerId, p_visitor_id: visitorId });
  if (error) console.warn("[offers]", error.message);
}

export async function trackOfferClick(offerId: string): Promise<void> {
  const { error } = await supabase.rpc("track_offer_click", { p_offer_id: offerId });
  if (error) console.warn("[offers]", error.message);
}

const OFFERS_READ_EVENT = "saovia:offers-read";

/** Notifies any mounted useUnreadOffersCount() to refetch -- fired after markOfferRead so the bottom-nav badge drops without a page reload or prop-drilled callback. */
export function notifyOfferRead() {
  window.dispatchEvent(new Event(OFFERS_READ_EVENT));
}

/** Standalone from the offers sheet's own fetch so the badge is correct even before the sheet has ever been opened this visit. */
export function useUnreadOffersCount(slug: string | null | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const restaurantSlug = slug;
    let cancelled = false;
    function refresh() {
      const visitorId = getOrCreateVisitorId();
      fetchUnreadOffersCount(restaurantSlug, visitorId)
        .then((n) => { if (!cancelled) setCount(n); })
        .catch((err: unknown) => console.warn("[offers]", err instanceof Error ? err.message : err));
    }
    refresh();
    window.addEventListener(OFFERS_READ_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFERS_READ_EVENT, refresh);
    };
  }, [slug]);

  return count;
}

// ---------------------------------------------------------------------------
// Admin (tenant) side
// ---------------------------------------------------------------------------

export type Offer = {
  id: string;
  restaurant_id: string;
  product_id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  original_price: number;
  offer_price: number;
  status: OfferStatus;
  starts_at: string | null;
  ends_at: string | null;
  views_count: number;
  clicks_count: number;
  created_at: string;
};

export type OfferInput = {
  product_id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  original_price: number;
  offer_price: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type OfferAnalytics = {
  offer_id: string;
  title: string;
  status: OfferStatus;
  recipients_count: number;
  opened_count: number;
  views_count: number;
  clicks_count: number;
  conversions_count: number;
  revenue: number;
  conversion_rate: number;
};

export async function fetchOffers(restaurantId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("id,restaurant_id,product_id,title,description,image_path,original_price,offer_price,status,starts_at,ends_at,views_count,clicks_count,created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Offer[];
}

/** `status` defaults to 'draft' -- mirrors createPromotion's create-then-activate flow. */
export async function createOffer(restaurantId: string, input: OfferInput, status: OfferStatus = "draft"): Promise<string> {
  const { data, error } = await supabase
    .from("offers")
    .insert({ restaurant_id: restaurantId, ...input, status })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateOffer(id: string, input: OfferInput): Promise<void> {
  const { error } = await supabase.from("offers").update(input).eq("id", id);
  if (error) throw error;
}

/** 'draft' is the creation default and 'expired' is display-only (see getOfferDisplayStatus) -- only 'active'/'disabled' are ever set directly by a tenant. */
export async function setOfferStatus(id: string, status: "active" | "disabled"): Promise<void> {
  const { error } = await supabase.from("offers").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteOffer(id: string): Promise<void> {
  const { error } = await supabase.from("offers").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchOffersAnalytics(): Promise<OfferAnalytics[]> {
  const { data, error } = await supabase.rpc("get_offers_analytics");
  if (error) throw error;
  return (data as unknown as OfferAnalytics[] | null) ?? [];
}

/**
 * The stored status can lag reality: a row can still say 'active' after its
 * ends_at has passed (the backend never auto-flips it, it just stops
 * honoring it -- see get_tenant_offers). This is display-only, never
 * written back. Mirrors promotions.ts's getDisplayStatus.
 */
export function getOfferDisplayStatus(offer: Pick<Offer, "status" | "ends_at">): OfferStatus {
  if (offer.status === "active" && offer.ends_at && new Date(offer.ends_at).getTime() < Date.now()) return "expired";
  return offer.status;
}
