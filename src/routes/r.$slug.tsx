import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { useMenuData } from "@/lib/menu-db";
import { CartProvider, useCart } from "@/lib/cart";
import { TenantOrderDrawer } from "@/components/TenantOrderDrawer";
import { CategoriesSheet } from "@/components/CategoriesSheet";
import { TenantHeader } from "@/components/tenant/TenantHeader";
import { TenantSearchBar } from "@/components/tenant/TenantSearchBar";
import { TenantHero } from "@/components/tenant/TenantHero";
import { TenantCategoryNav } from "@/components/tenant/TenantCategoryNav";
import { TenantPopularSection } from "@/components/tenant/TenantPopularSection";
import { TenantPromoBanner } from "@/components/tenant/TenantPromoBanner";
import { TenantProductCard } from "@/components/tenant/TenantProductCard";
import { TenantProductModal } from "@/components/tenant/TenantProductModal";
import { TenantCartBar } from "@/components/tenant/TenantCartBar";
import { TenantBottomNav } from "@/components/tenant/TenantBottomNav";
import { TenantTrustBar } from "@/components/tenant/TenantTrustBar";
import {
  TenantEmptyMenuState,
  TenantErrorState,
  TenantNotFoundState,
  TenantStorefrontSkeleton,
} from "@/components/tenant/TenantStorefrontStates";
import type { MenuItem } from "@/data/menu";

function TenantLocationSection({ name, address, commune, city, countryCode }: { name: string; address: string | null; commune: string | null; city: string | null; countryCode: string | null; }) {
  const addressLines = [address, commune, city].filter(Boolean) as string[];
  if (addressLines.length === 0) return null;

  const mapsQuery = [address, commune, city, countryCode].filter(Boolean).join(", ");
  const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}`;
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`;

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
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { name: "description", content: "Consultez le menu et les informations de ce restaurant." },
      { name: "author", content: "Pacha Flavors Connect" },
      { property: "og:description", content: "Consultez le menu et les informations de ce restaurant." },
    ],
  }),
  component: TenantStorefrontPage,
});

function TenantStorefrontPage() {
  const { slug } = Route.useParams();
  return (
    <CartProvider>
      <TenantStorefront slug={slug} />
    </CartProvider>
  );
}

function TenantStorefront({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useMenuData(slug);
  const { count, subtotal, hasUnpriced, openCart, add } = useCart();
  const [active, setActive] = useState("tous");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  if (isLoading) return <TenantStorefrontSkeleton />;
  if (isError) return <TenantErrorState onRetry={() => void refetch()} />;
  if (!data?.restaurant) return <TenantNotFoundState />;

  const { restaurant, settings } = data;
  const hasMenu = data.categories.length > 0 || data.rows.length > 0;
  const tabs = [{ id: "tous", label: "Tous" }, ...data.categories.map((c) => ({ id: slugify(c.label), label: c.label }))];
  const normalizedQuery = query.trim().toLowerCase();
  const items = data.items
    .filter((i) => active === "tous" || i.category === active)
    .filter((i) => !normalizedQuery || i.name.toLowerCase().includes(normalizedQuery) || i.description.toLowerCase().includes(normalizedQuery));
  const subtotalLabel = hasUnpriced ? (subtotal > 0 ? `${subtotal.toLocaleString("fr-FR")} FCFA` : "À confirmer") : `${subtotal.toLocaleString("fr-FR")} FCFA`;
  const hasContact = Boolean(restaurant.address || restaurant.commune || restaurant.city);

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-28 md:pb-0">
      <TenantHeader restaurant={restaurant} cartCount={count} subtotalLabel={subtotalLabel} hasContact={hasContact} onOpenCart={openCart} />
      {hasMenu && <TenantSearchBar value={query} onChange={setQuery} onOpenFilters={() => setCategoriesOpen(true)} />}

      <main>
        <TenantHero restaurant={restaurant} settings={settings} />
        {hasMenu && <TenantCategoryNav tabs={tabs} active={active} onSelect={setActive} onOpenCategories={() => setCategoriesOpen(true)} />}
        {hasMenu && <TenantPopularSection items={data.items} onOpen={setOpenItem} />}
        <TenantPromoBanner restaurant={restaurant} settings={settings} />
        <section id="carte" className="section-pad bg-[#F7F7F7]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">La carte</p>
            <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Notre carte</h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">Sélectionnez vos plats, ajoutez-les au panier et commandez en quelques secondes.</p>
            {!hasMenu ? <TenantEmptyMenuState /> : items.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-[#EAEAEA] bg-white p-6 text-center text-sm text-[#666666]">Aucun plat ne correspond à votre recherche.</p>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((item) => <TenantProductCard key={item.id} item={item} onOpen={setOpenItem} />)}</div>
            )}
          </div>
        </section>
        {hasMenu && <TenantTrustBar />}
        <TenantLocationSection name={restaurant.name} address={restaurant.address} commune={restaurant.commune} city={restaurant.city} countryCode={restaurant.country_code} />
      </main>

      <footer className="bg-cocoa py-10 text-cocoa-foreground">
        <div className="mx-auto max-w-7xl px-4 text-xs text-cocoa-foreground/60 sm:px-6">© {new Date().getFullYear()} {restaurant.name}</div>
      </footer>

      <TenantProductModal item={openItem} onClose={() => setOpenItem(null)} onAdd={(item, qty) => { for (let i = 0; i < qty; i += 1) add(item); }} />
      <TenantCartBar count={count} subtotalLabel={subtotalLabel} onOpenCart={openCart} />
      <TenantBottomNav restaurantSlug={restaurant.slug} />
      <TenantOrderDrawer restaurantSlug={restaurant.slug} restaurantName={restaurant.name} />
      <CategoriesSheet slug={slug} open={categoriesOpen} onOpenChange={setCategoriesOpen} onSelectCategory={setActive} />
    </div>
  );
}
