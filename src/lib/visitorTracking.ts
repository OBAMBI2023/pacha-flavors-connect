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
function getOrCreateVisitorId(): string | null {
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

function track(slug: string, visitorId: string) {
  // Fire-and-forget: a tracking failure must never surface an error to the
  // customer or block the storefront from working.
  void supabase.rpc("track_visitor_session", { p_slug: slug, p_visitor_id: visitorId }).then(({ error }) => {
    if (error) console.warn("[visitor-tracking]", error.message);
  });
}

/**
 * Call once from the top of a tenant's public storefront page. Tracks the
 * initial visit immediately, then a heartbeat every 60s so a still-open tab
 * keeps counting as "online" (see get_visitor_realtime_count's 5-minute
 * window) -- cleared on unmount so a closed/navigated-away tab stops.
 */
export function useVisitorTracking(slug: string | null | undefined) {
  useEffect(() => {
    if (!slug) return;
    const visitorId = getOrCreateVisitorId();
    if (!visitorId) return;

    track(slug, visitorId);
    const interval = window.setInterval(() => track(slug, visitorId), HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [slug]);
}
