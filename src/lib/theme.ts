export type RestaurantTheme = {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  font_family: string | null;
  border_radius: string | null;
};

/**
 * The platform's official default theme -- the same values already hard-
 * coded as the light-mode CSS custom properties in src/styles.css. A tenant
 * whose restaurant_settings theme columns are null inherits these as-is;
 * this is the single source of truth for "no theme configured" rather than
 * a second, drifting copy of the brand palette.
 */
export const DEFAULT_THEME: RestaurantTheme = {
  primary_color: "oklch(0.585 0.145 47)",
  secondary_color: "oklch(0.94 0.02 80)",
  accent_color: "oklch(0.93 0.035 80)",
  background_color: "oklch(0.975 0.012 85)",
  surface_color: "oklch(0.992 0.008 85)",
  text_color: "oklch(0.26 0.045 55)",
  font_family: null,
  border_radius: "0.75rem",
};

/**
 * Maps a restaurant's theme onto the exact CSS custom properties already
 * defined in src/styles.css (--primary, --secondary, --accent, --background,
 * --card for surface, --foreground for text, --radius, --font-sans) so every
 * existing Tailwind utility (bg-primary, text-foreground, rounded-lg...)
 * picks it up automatically -- no parallel theming system.
 */
export function applyRestaurantTheme(theme: Partial<RestaurantTheme>): void {
  const root = document.documentElement.style;
  const merged = { ...DEFAULT_THEME, ...theme };
  if (merged.primary_color) root.setProperty("--primary", merged.primary_color);
  if (merged.secondary_color) root.setProperty("--secondary", merged.secondary_color);
  if (merged.accent_color) root.setProperty("--accent", merged.accent_color);
  if (merged.background_color) root.setProperty("--background", merged.background_color);
  if (merged.surface_color) root.setProperty("--card", merged.surface_color);
  if (merged.text_color) root.setProperty("--foreground", merged.text_color);
  if (merged.border_radius) root.setProperty("--radius", merged.border_radius);
  if (merged.font_family) root.setProperty("--font-sans", merged.font_family);
}
