import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyRestaurantTheme, type RestaurantTheme } from "@/lib/theme";

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
      if (faviconUrl) {
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (link) link.href = faviconUrl;
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);
}
