import type { MenuItem } from "@/data/menu";
import { slugify, type DbCategory, type PublicBusinessHoursEntry, type PublicRestaurant, type PublicRestaurantSettings } from "@/lib/menu-db";

/**
 * Central, reusable SEO module for every tenant storefront. Every field it
 * emits is resolved from the already-fetched, already-tenant-scoped
 * get_public_menu payload (restaurant/settings for exactly one slug) --
 * nothing here ever reaches across tenants, and nothing here touches
 * private data (orders, customers, Admin). Consumers (route `head()`
 * functions, the build-time sitemap/robots generator) import from here
 * instead of building their own meta/JSON-LD, so every tenant page renders
 * SEO output the same, correct way.
 */

const SOCIAL_LOCALE = "fr_FR";

/** Narrow input shapes for the title/description/canonical resolvers -- lets callers (like the Admin SEO preview) pass a minimal object instead of a full PublicRestaurant/PublicRestaurantSettings. */
type SeoRestaurantInput = Pick<PublicRestaurant, "name" | "slug" | "commune" | "city" | "cover_url" | "logo_url">;
type SeoSettingsInput = Pick<
  PublicRestaurantSettings,
  "seo_title" | "seo_description" | "seo_keywords" | "seo_og_image_url" | "tagline" | "description"
>;

const ENGLISH_WEEKDAY: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/**
 * The app's own default origin. Set VITE_SITE_URL in the deployment
 * environment to the real production domain (https://saovia.net). Deliberately
 * never falls back to window.location.origin: this value feeds a route's
 * `head()`, which TanStack Router runs both during SSR (no window) and again
 * client-side during hydration -- if the two runs disagreed (fallback
 * placeholder vs. whatever host the browser happened to be on, e.g. a
 * preview/dev origin), canonical/OG/JSON-LD would end up with mismatched
 * URLs across the same page. A single hardcoded fallback, identical in both
 * environments, keeps every emitted URL consistent even when VITE_SITE_URL
 * isn't configured -- it's SAOVIA's own production domain, not a dev host,
 * so an unconfigured deployment still emits correct, real URLs.
 */
function siteOrigin(): string {
  const configured = (import.meta.env as Record<string, string | undefined>)["VITE_SITE_URL"];
  return (configured ?? "https://saovia.net").replace(/\/+$/, "");
}

/**
 * The tenant's own canonical origin: its verified, active, primary custom
 * domain (resolved from `tenant_domains` -- see src/lib/tenantDomains.ts --
 * by the caller and passed in here) when it has one, otherwise the shared
 * app origin. Deliberately never reads `restaurant_settings.custom_domain`:
 * that free-text field has no ownership verification and would let any
 * tenant claim an arbitrary domain in canonical/OG tags -- `tenant_domains`,
 * gated by Super Admin + real DNS TXT verification, is the single source of
 * truth for this. Never guessed from request headers either, so it can
 * never leak one tenant's resolved host into another's canonical.
 */
function tenantOrigin(activeCustomDomain?: string | null): string {
  const custom = activeCustomDomain?.trim();
  if (custom) return `https://${custom.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return siteOrigin();
}

/** The tenant's own canonical page URL -- root path on its verified custom domain, `/r/<slug>` on the shared domain. */
export function tenantCanonicalUrl(
  restaurant: SeoRestaurantInput,
  settings: SeoSettingsInput | null,
  activeCustomDomain?: string | null,
): string {
  const origin = tenantOrigin(activeCustomDomain);
  const custom = activeCustomDomain?.trim();
  return custom ? `${origin}/` : `${origin}/r/${restaurant.slug}`;
}

export function resolveSeoTitle(restaurant: SeoRestaurantInput, settings: SeoSettingsInput | null): string {
  const override = settings?.seo_title?.trim();
  if (override) return override;
  const tagline = settings?.tagline?.trim();
  if (tagline) return `${restaurant.name} — ${tagline}`;
  const locality = [restaurant.commune, restaurant.city].filter(Boolean).join(", ");
  return locality ? `${restaurant.name} — Commander en ligne à ${locality}` : `${restaurant.name} — Commander en ligne`;
}

export function resolveSeoDescription(restaurant: SeoRestaurantInput, settings: SeoSettingsInput | null): string {
  const override = settings?.seo_description?.trim();
  if (override) return override;
  const fromProfile = settings?.description?.trim();
  if (fromProfile) return fromProfile;
  const locality = [restaurant.commune, restaurant.city].filter(Boolean).join(", ");
  return locality
    ? `Découvrez le menu de ${restaurant.name} et commandez en ligne à ${locality}. Livraison et retrait disponibles.`
    : `Découvrez le menu de ${restaurant.name} et commandez en ligne. Livraison et retrait disponibles.`;
}

export function resolveSeoKeywords(restaurant: SeoRestaurantInput, settings: SeoSettingsInput | null): string | null {
  const override = settings?.seo_keywords?.trim();
  if (override) return override;
  const parts = [restaurant.name, "restaurant", restaurant.commune, restaurant.city, "livraison", "commande en ligne"].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

export function resolveOgImage(restaurant: SeoRestaurantInput, settings: SeoSettingsInput | null): string | null {
  return settings?.seo_og_image_url?.trim() || restaurant.cover_url || restaurant.logo_url || null;
}

type MetaTag = Record<string, string>;

/**
 * Wraps a JSON-LD object for a route's `head()` `meta` array. TanStack
 * Router's HeadContent has special-cased runtime support for a
 * `{ "script:ld+json": ... }` meta entry -- it renders a real
 * `<script type="application/ld+json">` tag for it (see
 * node_modules/@tanstack/react-router/dist/esm/headContentUtils.js) -- but
 * this version's head() meta types don't model that shape, hence the one
 * documented cast here instead of scattering `as any` at every call site.
 */
export function jsonLdMetaEntry(data: Record<string, unknown>): MetaTag {
  return { "script:ld+json": data } as unknown as MetaTag;
}

/**
 * Builds the full `head()` return value for a tenant storefront page:
 * unique title, description, keywords, canonical link, Open Graph (og:*,
 * used by Facebook/WhatsApp/LinkedIn link unfurling), Twitter Card, GSC/Bing
 * verification tags when configured, favicon override, and `robots:
 * index,follow` (replacing the storefront's previous hardcoded `noindex`).
 * Every value here comes from a single tenant's own restaurant/settings
 * record -- never mixed with another tenant's data.
 */
export function buildTenantHeadMeta({
  restaurant,
  settings,
  activeCustomDomain,
}: {
  restaurant: PublicRestaurant;
  settings: PublicRestaurantSettings | null;
  activeCustomDomain?: string | null;
}): { meta: MetaTag[]; links: MetaTag[] } {
  const title = resolveSeoTitle(restaurant, settings);
  const description = resolveSeoDescription(restaurant, settings);
  const keywords = resolveSeoKeywords(restaurant, settings);
  const ogImage = resolveOgImage(restaurant, settings);
  const canonicalUrl = tenantCanonicalUrl(restaurant, settings, activeCustomDomain);

  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index, follow" },
    { property: "og:type", content: "restaurant.restaurant" },
    { property: "og:site_name", content: restaurant.name },
    { property: "og:locale", content: SOCIAL_LOCALE },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];

  if (keywords) meta.push({ name: "keywords", content: keywords });
  if (ogImage) {
    meta.push({ property: "og:image", content: ogImage });
    meta.push({ name: "twitter:image", content: ogImage });
  }
  if (settings?.google_site_verification?.trim()) {
    meta.push({ name: "google-site-verification", content: settings.google_site_verification.trim() });
  }
  if (settings?.bing_site_verification?.trim()) {
    meta.push({ name: "msvalidate.01", content: settings.bing_site_verification.trim() });
  }

  const links: MetaTag[] = [{ rel: "canonical", href: canonicalUrl }];
  if (restaurant.favicon_url) links.push({ rel: "icon", href: restaurant.favicon_url });

  return { meta, links };
}

/** schema.org PostalAddress -- omitted fields simply aren't included, never fabricated. */
function buildPostalAddress(restaurant: PublicRestaurant): Record<string, unknown> | undefined {
  if (!restaurant.address && !restaurant.commune && !restaurant.city) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: restaurant.address ?? undefined,
    addressLocality: restaurant.commune ?? restaurant.city ?? undefined,
    addressRegion: restaurant.city ?? undefined,
    addressCountry: restaurant.country_code ?? undefined,
  };
}

function buildOpeningHoursSpecification(businessHours: PublicBusinessHoursEntry[]): Record<string, unknown>[] | undefined {
  const open = businessHours.filter((h) => h.is_open && h.opening_time && h.closing_time);
  if (open.length === 0) return undefined;
  return open.map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: `https://schema.org/${ENGLISH_WEEKDAY[h.day_of_week]}`,
    opens: h.opening_time!.slice(0, 5),
    closes: h.closing_time!.slice(0, 5),
  }));
}

/**
 * Restaurant + LocalBusiness structured data (combined via a multi-type
 * @type, the standard schema.org pattern) for the tenant's own storefront
 * page. Only ever built from that one tenant's restaurant/settings/hours.
 */
export function buildRestaurantJsonLd({
  restaurant,
  settings,
  businessHours,
  canonicalUrl,
}: {
  restaurant: PublicRestaurant;
  settings: PublicRestaurantSettings | null;
  businessHours: PublicBusinessHoursEntry[];
  canonicalUrl: string;
}): Record<string, unknown> {
  const image = resolveOgImage(restaurant, settings);
  const address = buildPostalAddress(restaurant);
  const openingHours = buildOpeningHoursSpecification(businessHours);
  const tagline = settings?.tagline?.trim();
  const description = resolveSeoDescription(restaurant, settings);

  return {
    "@context": "https://schema.org",
    "@type": ["Restaurant", "LocalBusiness"],
    "@id": canonicalUrl,
    name: restaurant.name,
    url: canonicalUrl,
    ...(restaurant.legal_name ? { legalName: restaurant.legal_name } : {}),
    ...(tagline ? { slogan: tagline } : {}),
    ...(image ? { image } : {}),
    ...(restaurant.logo_url ? { logo: restaurant.logo_url } : {}),
    ...(restaurant.phone ? { telephone: restaurant.phone } : {}),
    ...(restaurant.email ? { email: restaurant.email } : {}),
    ...(address ? { address } : {}),
    ...(restaurant.lat !== null && restaurant.lng !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: restaurant.lat, longitude: restaurant.lng } }
      : {}),
    ...(openingHours ? { openingHoursSpecification: openingHours } : {}),
    ...(description ? { description } : {}),
  };
}

/**
 * schema.org Menu structured data for the products currently on the
 * tenant's storefront -- lets a search engine understand the menu even
 * though individual dishes don't have their own indexable URLs yet.
 */
export function buildMenuJsonLd({
  categories,
  items,
  currency,
  canonicalUrl,
}: {
  categories: DbCategory[];
  items: MenuItem[];
  currency: string | null;
  canonicalUrl: string;
}): Record<string, unknown> | null {
  const availableItems = items.filter((item) => item.available && item.price !== null);
  if (availableItems.length === 0) return null;

  const priceCurrency = currency ?? "XOF";
  const sections = categories
    .map((category) => {
      const sectionItems = availableItems.filter((item) => item.category === slugify(category.label));
      if (sectionItems.length === 0) return null;
      return {
        "@type": "MenuSection",
        name: category.label,
        hasMenuItem: sectionItems.map((item) => buildMenuItemJsonLd(item, priceCurrency)),
      };
    })
    .filter((section): section is NonNullable<typeof section> => section !== null);

  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${canonicalUrl}#menu`,
    url: canonicalUrl,
    hasMenuSection: sections.length > 0 ? sections : undefined,
    hasMenuItem: sections.length === 0 ? availableItems.map((item) => buildMenuItemJsonLd(item, priceCurrency)) : undefined,
  };
}

function buildMenuItemJsonLd(item: MenuItem, priceCurrency: string) {
  return {
    "@type": "MenuItem",
    name: item.name,
    description: item.description || undefined,
    image: item.image || undefined,
    offers: {
      "@type": "Offer",
      price: item.promotion?.final_price ?? item.price,
      priceCurrency,
      availability: "https://schema.org/InStock",
    },
  };
}

/** BreadcrumbList structured data. `trail` is ordered root-first; each entry's `url` must already be absolute. */
export function buildBreadcrumbJsonLd(trail: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
}

export { siteOrigin, tenantOrigin };
