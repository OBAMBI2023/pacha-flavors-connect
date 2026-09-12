import {
  Award,
  ChefHat,
  Clock,
  Flame,
  Heart,
  Leaf,
  Sparkles,
  Star,
  Timer,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icon allow-list shared by the admin "Notre histoire" form (picker
 * + preview) and the public TenantAboutSection (render) -- a highlight's
 * `icon` field is a plain string key into this map, never an arbitrary
 * component/HTML, so an unrecognized or tampered value just falls back to
 * the default icon instead of breaking the render.
 */
export const ABOUT_HIGHLIGHT_ICONS: Record<string, LucideIcon> = {
  Leaf,
  ChefHat,
  Flame,
  Timer,
  Heart,
  Star,
  Award,
  Utensils,
  Sparkles,
  Clock,
};

export const ABOUT_HIGHLIGHT_ICON_NAMES = Object.keys(ABOUT_HIGHLIGHT_ICONS);

export const DEFAULT_ABOUT_HIGHLIGHT_ICON = "Leaf";

export function resolveAboutHighlightIcon(icon: string | undefined): LucideIcon {
  return (icon && ABOUT_HIGHLIGHT_ICONS[icon]) || Leaf;
}
