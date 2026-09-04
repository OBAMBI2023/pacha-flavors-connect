import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyRestaurantTheme, type RestaurantTheme } from "@/lib/theme";

/** The platform's own favicon (see __root.tsx's `<link rel="icon">`) -- restored whenever no tenant favicon override is in effect, so the browser tab never keeps showing a tenant's icon outside that tenant's own admin pages (e.g. after logging out to /auth). */
const PLATFORM_FAVICON_HREF = "/favicon.ico";

/**
 * Loads and applies a restaurant's official theme (colors, font, radius,
 * favicon) as soon as its id is known -- covers "thème disponible
 * immédiatement après la première connexion". Isolation is automatic: the
 * query is scoped by restaurantId and RLS (settings_select_members /
 * restaurants_select_members_or_super_admin) already restricts reads to
 * members of that one restaurant, so one tenant's session can never load
 * another tenant's theme.
 */
export function useRestaurantTheme(restaurantId: string | null): void {
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;

    async function load() {
      const [{ data: settings }, { data: restaurant }] = await Promise.all([
        supabase
          .from("restaurant_settings")
          .select("primary_color,secondary_color,accent_color,background_color,surface_color,text_color,font_family,border_radius")
          .eq("restaurant_id", restaurantId)
          .maybeSingle(),
        supabase.from("restaurants").select("favicon_url,logo_url").eq("id", restaurantId).maybeSingle(),
      ]);
      if (cancelled) return;

      applyRestaurantTheme((settings ?? {}) as Partial<RestaurantTheme>);

      const faviconUrl = restaurant?.favicon_url ?? restaurant?.logo_url ?? null;
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) link.href = faviconUrl ?? PLATFORM_FAVICON_HREF;
    }

    void load();
    return () => {
      cancelled = true;
      // Leaving this tenant's admin pages (e.g. logging out to /auth, or a
      // super admin switching away) -- the tab must go back to showing
      // Saovia Food's own favicon, never leave the last tenant's icon stuck
      // in the DOM (this hook set it directly, bypassing the router's own
      // head diffing, so nothing else would ever revert it).
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) link.href = PLATFORM_FAVICON_HREF;
    };
  }, [restaurantId]);
}
