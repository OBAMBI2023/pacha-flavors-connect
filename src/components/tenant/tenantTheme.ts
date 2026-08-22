import { useEffect } from "react";

/**
 * Premium red/cream storefront palette. Applied to the document root (not a
 * scoped wrapper element) because TenantProductModal, TenantOrderDrawer's
 * account-lookup modal, and CategoriesSheet all render through a React/Radix
 * portal straight to document.body -- outside any wrapper div's DOM subtree,
 * where a scoped CSS-variable override would never reach them.
 *
 * This mirrors the same document-level technique src/hooks/useRestaurantTheme.ts
 * already uses for the admin panel, so the pattern isn't new to this codebase.
 * It never touches src/lib/theme.ts or styles.css -- only runtime CSS custom
 * properties, reverted on unmount -- so admin, super-admin, the marketplace
 * and the legacy "/" page keep the platform's default theme whenever a
 * /r/$slug page isn't mounted.
 */
const STOREFRONT_VARS: Record<string, string> = {
  "--background": "oklch(0.98 0.016 70)",
  "--foreground": "oklch(0.22 0.015 40)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.22 0.015 40)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.22 0.015 40)",
  "--primary-foreground": "oklch(0.99 0.005 90)",
  "--secondary": "oklch(0.93 0.05 75)",
  "--secondary-foreground": "oklch(0.32 0.06 50)",
  "--muted": "oklch(0.95 0.012 65)",
  "--muted-foreground": "oklch(0.52 0.02 45)",
  "--accent": "oklch(0.93 0.05 75)",
  "--accent-foreground": "oklch(0.32 0.06 50)",
  "--border": "oklch(0.91 0.012 60)",
  "--input": "oklch(0.91 0.012 60)",
};

/** #E53935-family red, used whenever a tenant hasn't set their own primary_color. */
const DEFAULT_STOREFRONT_PRIMARY = "oklch(0.58 0.22 27)";

/**
 * `primaryColor` is the tenant's own restaurant_settings.primary_color,
 * already returned publicly by the get_public_menu RPC -- real per-tenant
 * branding on top of the shared premium base, no backend changes needed.
 */
export function useStorefrontTheme(primaryColor?: string | null): void {
  useEffect(() => {
    const root = document.documentElement.style;
    const previous: Record<string, string> = {};

    for (const key of [...Object.keys(STOREFRONT_VARS), "--primary", "--ring"]) {
      previous[key] = root.getPropertyValue(key);
    }

    for (const [key, value] of Object.entries(STOREFRONT_VARS)) {
      root.setProperty(key, value);
    }
    const primary = primaryColor || DEFAULT_STOREFRONT_PRIMARY;
    root.setProperty("--primary", primary);
    root.setProperty("--ring", primary);

    return () => {
      for (const [key, value] of Object.entries(previous)) {
        if (value) root.setProperty(key, value);
        else root.removeProperty(key);
      }
    };
  }, [primaryColor]);
}
