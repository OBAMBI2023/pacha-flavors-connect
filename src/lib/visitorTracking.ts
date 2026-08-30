import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const VISITOR_ID_KEY = "saovia.visitor_id";
const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * A client-generated anonymous token, nothing more -- no name, phone,
 * email, address, or precise location is ever attached to it. Persisted in
 * localStorage only (never sent to any third party), so the same browser
 * is recognized as one "visitor" across sessions.
 */
/** Exported for other storefront features (e.g. offers read-tracking) that need this app's one anonymous identity primitive, without duplicating the localStorage logic. */
export function getOrCreateVisitorId(): string | null {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    // Private browsing / storage disabled -- tracking just no-ops for this visit.
    return null;
  }
}

function track(slug: string, visitorId: string, source: string | null) {
  // Fire-and-forget: a tracking failure must never surface an error to the
  // customer or block the storefront from working.
  void supabase.rpc("track_visitor_session", { p_slug: slug, p_visitor_id: visitorId, p_source: source }).then(({ error }) => {
    if (error) console.warn("[visitor-tracking]", error.message);
  });
}

const QR_ATTRIBUTION_KEY = "saovia.qr_attribution";

/**
 * Records that this browser tab landed on this tenant's storefront via its
 * QR code (?source=qr in the URL). sessionStorage only -- clears itself
 * when the tab closes, so the attribution never outlives "this session" as
 * required. Scoped by slug so it can never leak onto an order placed for a
 * different tenant browsed in the same tab afterwards.
 */
function recordQrAttribution(slug: string) {
  try {
    window.sessionStorage.setItem(QR_ATTRIBUTION_KEY, JSON.stringify({ slug, at: Date.now() }));
  } catch {
    // Storage disabled (private browsing) -- attribution just won't apply this visit.
  }
}

/** True only if the current tab's most recent QR landing was for this exact tenant. */
export function hasQrAttribution(slug: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(QR_ATTRIBUTION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { slug?: unknown };
    return parsed.slug === slug;
  } catch {
    return false;
  }
}

/**
 * Call once from the top of a tenant's public storefront page. Tracks the
 * initial visit immediately, then a heartbeat every 60s so a still-open tab
 * keeps counting as "online" (see get_visitor_realtime_count's 5-minute
 * window) -- cleared on unmount so a closed/navigated-away tab stops. The
 * `?source=qr` check happens once per mount (the URL doesn't change for the
 * rest of this SPA session) and is recorded both as the session's source tag
 * and as this tab's order-attribution flag.
 */
export function useVisitorTracking(slug: string | null | undefined) {
  useEffect(() => {
    if (!slug) return;
    const visitorId = getOrCreateVisitorId();
    if (!visitorId) return;

    const isFromQr = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "qr";
    if (isFromQr) recordQrAttribution(slug);
    const source = isFromQr ? "qr" : null;

    track(slug, visitorId, source);
    const interval = window.setInterval(() => track(slug, visitorId, source), HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [slug]);
}
