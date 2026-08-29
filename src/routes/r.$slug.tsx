import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Navigation, Phone } from "lucide-react";
import { fetchMenuData, useMenuData, type MenuData } from "@/lib/menu-db";
import { formatMoney } from "@/lib/currency";
import { buildBreadcrumbJsonLd, buildMenuJsonLd, buildRestaurantJsonLd, buildTenantHeadMeta, jsonLdMetaEntry, tenantCanonicalUrl } from "@/lib/seo";
import { DEFAULT_DELIVERY_FEE_FALLBACK } from "@/lib/deliveryPricing";
import { CartProvider, useCart } from "@/lib/cart";
import { DeliveryLocationProvider } from "@/lib/deliveryLocation";
import { TenantOrderDrawer } from "@/components/TenantOrderDrawer";
import { TenantLocationBar } from "@/components/tenant/TenantLocationBar";
import { TenantLocationModal } from "@/components/tenant/TenantLocationModal";
import { CategoriesSheet } from "@/components/CategoriesSheet";
import { useStorefrontTheme } from "@/components/tenant/tenantTheme";
import { TenantHeader } from "@/components/tenant/TenantHeader";
import { TenantSearchBar } from "@/components/tenant/TenantSearchBar";
import { TenantHero } from "@/components/tenant/TenantHero";
import { TenantCategoryNav } from "@/components/tenant/TenantCategoryNav";
import { TenantPopularSection } from "@/components/tenant/TenantPopularSection";
import { TenantProductCard } from "@/components/tenant/TenantProductCard";
import { TenantProductModal } from "@/components/tenant/TenantProductModal";
import { TenantCartBar } from "@/components/tenant/TenantCartBar";
import { TenantBottomNav } from "@/components/tenant/TenantBottomNav";
import { TenantOffersSheet } from "@/components/tenant/TenantOffersSheet";
import type { TenantOffer } from "@/lib/offers";
import { TenantNotificationsSheet } from "@/components/tenant/TenantNotificationsSheet";
import { TenantTrustBar } from "@/components/tenant/TenantTrustBar";
import { PublicFooter } from "@/components/PublicFooter";
import { useVisitorTracking } from "@/lib/visitorTracking";
import {
  TenantEmptyMenuState,
  TenantErrorState,
  TenantNotFoundState,
  TenantStorefrontSkeleton,
} from "@/components/tenant/TenantStorefrontStates";
import type { MenuItem } from "@/data/menu";

function TenantLocationSection({
  name,
  address,
  commune,
  city,
  countryCode,
  phone,
}: {
  name: string;
  address: string | null;
  commune: string | null;
  city: string | null;
  countryCode: string | null;
  phone: string | null;
}) {
  const addressLines = [address, commune, city].filter(Boolean) as string[];
  if (addressLines.length === 0) return null;

  const mapsQuery = [address, commune, city, countryCode].filter(Boolean).join(", ");
  const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}`;
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`;
  // tel: hrefs must be digits/+ only -- the stored phone value may contain
  // spaces or separators meant for human display.
  const phoneHref = phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : null;

  return (
    <section id="localisation" className="section-pad bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">Nous trouver</p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{name}</h2>
          <address className="mt-8 flex gap-3 text-sm not-italic leading-relaxed">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>{addressLines.join(", ")}</span>
          </address>
          {phoneHref && (
            <p className="mt-3 flex items-center gap-3 text-sm leading-relaxed">
              <Phone className="h-5 w-5 shrink-0 text-primary" />
              <a href={phoneHref} className="font-semibold hover:text-primary">
                {phone}
              </a>
            </p>
          )}
          <a href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-accent">
            <Navigation className="h-4 w-4" /> Itinéraire
          </a>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <iframe title={`Localisation de ${name}`} src={mapsEmbedUrl} loading="lazy" className="h-80 w-full lg:h-full" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </div>
    </section>
  );
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const Route = createFileRoute("/r/$slug")({
  // SSR'd so per-tenant title/description/OG/Twitter/JSON-LD are already in
  // the initial HTML -- required for crawlers that don't execute JS
  // (WhatsApp, Facebook, LinkedIn link previews) to see the real tenant,
  // not a generic shell. The loader primes the exact same React Query
  // cache key useMenuData() reads client-side, so this changes nothing
  // about how the page fetches or renders its data.
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["menu-data", params.slug],
      queryFn: () => fetchMenuData(params.slug),
    }),
  head: ({ loaderData }) => {
    const data = loaderData as MenuData | undefined;
    const restaurant = data?.restaurant;
    if (!restaurant) {
      // Unknown/private slug -- never fabricate tenant data, never index.
      return { meta: [{ name: "robots", content: "noindex" }] };
    }
    const canonicalUrl = tenantCanonicalUrl(restaurant, data.settings);
    const { meta, links } = buildTenantHeadMeta({ restaurant, settings: data.settings });
    const restaurantJsonLd = buildRestaurantJsonLd({
      restaurant,
      settings: data.settings,
      businessHours: data.businessHours,
      canonicalUrl,
    });
    const menuJsonLd = buildMenuJsonLd({
      categories: data.categories,
      items: data.items,
      currency: restaurant.currency,
      canonicalUrl,
    });
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Accueil", url: tenantCanonicalUrl(restaurant, data.settings) },
      { name: restaurant.name, url: canonicalUrl },
    ]);
    return {
      meta: [
        ...meta,
        jsonLdMetaEntry(restaurantJsonLd),
        ...(menuJsonLd ? [jsonLdMetaEntry(menuJsonLd)] : []),
        jsonLdMetaEntry(breadcrumbJsonLd),
      ],
      links,
    };
  },
  component: TenantStorefrontPage,
});

function TenantStorefrontPage() {
  const { slug } = Route.useParams();
  return (
    <CartProvider>
      <DeliveryLocationProvider>
        <TenantStorefront slug={slug} />
      </DeliveryLocationProvider>
    </CartProvider>
  );
}

function TenantStorefront({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useMenuData(slug);
  const { count, subtotal, hasUnpriced, openCart, add, setActiveOfferId } = useCart();
  const [active, setActive] = useState("tous");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  /** Set when openItem was opened via an offer's "Profiter de l'offre" CTA (product has option groups) -- the shared product modal below is used for both the regular menu and offer claims, so option selection always runs through the same, single Radix-safe instance. */
  const [pendingOfferClaim, setPendingOfferClaim] = useState<TenantOffer | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useStorefrontTheme(data?.settings?.primary_color);
  useVisitorTracking(slug);

  function handleSearchChange(value: string) {
    setQuery(value);
    if (value.trim() !== "" && active !== "tous") setActive("tous");
  }

  if (isLoading) return <TenantStorefrontSkeleton />;
  if (isError) return <TenantErrorState onRetry={() => void refetch()} />;
  if (!data?.restaurant) return <TenantNotFoundState />;

  const { restaurant, settings } = data;
  const hasMenu = data.categories.length > 0 || data.rows.length > 0;
  const tabs = [{ id: "tous", label: "Tous" }, ...data.categories.map((c) => ({ id: slugify(c.label), label: c.label }))];
  const normalizedQuery = query.trim().toLowerCase();
  // A search is a global lookup across the whole catalog: it must never be
  // silently narrowed by whichever category tab happens to still be
  // selected (that previously made matches outside the active category
  // disappear with no indication why, which looked exactly like "search is
  // broken"). handleSearchChange resets `active` to "tous" so the visible
  // tab state matches what's actually being searched.
  const items = data.items
    .filter((i) => normalizedQuery || active === "tous" || i.category === active)
    .filter((i) => {
      if (!normalizedQuery) return true;
      const haystack = `${i.name} ${i.subtitle ?? ""} ${i.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  const subtotalLabel = hasUnpriced ? (subtotal > 0 ? formatMoney(subtotal, restaurant.currency) : "À confirmer") : formatMoney(subtotal, restaurant.currency);
  const hasContact = Boolean(restaurant.address || restaurant.commune || restaurant.city);
  const openOffers = () => { setOpenOfferId(null); setOffersOpen(true); };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-0">
      <TenantHeader restaurant={restaurant} subtotalLabel={subtotalLabel} hasContact={hasContact} onOpenOffers={openOffers} onOpenNotifications={() => setNotificationsOpen(true)} />
      <TenantLocationBar />
      {hasMenu && <TenantSearchBar value={query} onChange={handleSearchChange} onOpenFilters={() => setCategoriesOpen(true)} />}

      <main>
        <TenantHero restaurant={restaurant} />
        {hasMenu && <TenantCategoryNav tabs={tabs} active={active} onSelect={setActive} onOpenCategories={() => setCategoriesOpen(true)} />}
        {hasMenu && <TenantPopularSection items={data.items} currency={restaurant.currency} onOpen={setOpenItem} />}
        <section id="carte" className="pb-16 pt-3 md:pb-24 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {!hasMenu ? <TenantEmptyMenuState /> : items.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Aucun plat ne correspond à votre recherche.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((item) => <TenantProductCard key={item.id} item={item} currency={restaurant.currency} onOpen={setOpenItem} />)}</div>
            )}
          </div>
        </section>
        {hasMenu && <TenantTrustBar />}
        <TenantLocationSection name={restaurant.name} address={restaurant.address} commune={restaurant.commune} city={restaurant.city} countryCode={restaurant.country_code} phone={restaurant.phone} />
      </main>

      <PublicFooter restaurantName={restaurant.name} />

      <TenantProductModal
        item={openItem}
        currency={restaurant.currency}
        onClose={() => { setOpenItem(null); setPendingOfferClaim(null); }}
        onAdd={(item, qty, options) => {
          add(item, qty, options);
          if (pendingOfferClaim) {
            setActiveOfferId(pendingOfferClaim.id);
            setPendingOfferClaim(null);
            openCart();
          }
        }}
      />
      <TenantCartBar count={count} subtotalLabel={subtotalLabel} onOpenCart={openCart} />
      <TenantBottomNav restaurantSlug={restaurant.slug} restaurantName={restaurant.name} onOpenOffers={openOffers} />
      <TenantOrderDrawer restaurantSlug={restaurant.slug} restaurantName={restaurant.name} currency={restaurant.currency} availability={data.availability} timezone={restaurant.timezone ?? "Africa/Abidjan"} deliveryFeeFallback={settings?.delivery_fee_fallback ?? DEFAULT_DELIVERY_FEE_FALLBACK} restaurantLat={restaurant.lat} restaurantLng={restaurant.lng} deliveryEnabled={settings?.delivery_enabled ?? true} pickupEnabled={settings?.pickup_enabled ?? true} />
      <TenantLocationModal restaurantLat={restaurant.lat} restaurantLng={restaurant.lng} />
      <CategoriesSheet slug={slug} open={categoriesOpen} onOpenChange={setCategoriesOpen} onSelectCategory={setActive} />
      <TenantOffersSheet
        slug={restaurant.slug}
        items={data.items}
        currency={restaurant.currency}
        open={offersOpen}
        onOpenChange={(v) => { setOffersOpen(v); if (!v) setOpenOfferId(null); }}
        openOfferId={openOfferId}
        onNeedsOptions={(item, offer) => { setPendingOfferClaim(offer); setOpenItem(item); }}
      />
      <TenantNotificationsSheet
        slug={restaurant.slug}
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        onOpenOffer={(offerId) => { setOpenOfferId(offerId); setOffersOpen(true); }}
      />
    </div>
  );
}
