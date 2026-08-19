import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, ShoppingBag } from "lucide-react";
import { useMenuData } from "@/lib/menu-db";
import { CartProvider, useCart } from "@/lib/cart";
import { MenuCard } from "@/components/MenuCard";
import { TenantOrderDrawer } from "@/components/TenantOrderDrawer";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const Route = createFileRoute("/r/$slug")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }],
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
  const { data, isLoading } = useMenuData(slug);
  const { count, openCart } = useCart();
  const [active, setActive] = useState("tous");

  if (isLoading) {
    return <main className="p-10 text-center text-sm text-muted-foreground">Chargement…</main>;
  }

  if (!data?.restaurant) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Restaurant introuvable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ce restaurant n'existe pas ou n'est pas disponible publiquement pour le moment.
        </p>
        <Link to="/" className="mt-6 text-sm font-semibold text-primary underline underline-offset-4">
          Retour à l'accueil
        </Link>
      </main>
    );
  }

  const { restaurant, settings } = data;
  const hasMenu = data.categories.length > 0 || data.rows.length > 0;
  const tabs = [
    { id: "tous", label: "Tous" },
    ...data.categories.map((c) => ({ id: slugify(c.label), label: c.label })),
  ];
  const items = active === "tous" ? data.items : data.items.filter((i) => i.category === active);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
                {restaurant.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 truncate font-display text-xl font-semibold tracking-wide">
              {restaurant.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                aria-label="Appeler le restaurant"
                className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-accent"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={openCart}
              aria-label="Ouvrir le panier"
              className="relative grid h-10 w-10 place-items-center rounded-full border border-border transition-colors hover:bg-accent"
            >
              <ShoppingBag className="h-4 w-4" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="section-pad bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="font-display text-4xl font-semibold sm:text-5xl">{restaurant.name}</h1>
            {settings?.description && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {settings.description}
              </p>
            )}
            {(restaurant.address || restaurant.commune || restaurant.city) && (
              <p className="mt-4 text-sm text-muted-foreground">
                {[restaurant.address, restaurant.commune, restaurant.city].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </section>

        <section id="carte" className="section-pad bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">La carte</p>
            <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Notre carte</h2>

            {!hasMenu ? (
              <p className="mt-10 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Ce restaurant n'a pas encore publié de carte. Revenez bientôt.
              </p>
            ) : (
              <>
                <div className="-mx-4 mt-8 overflow-x-auto px-4 pb-2">
                  <div className="flex w-max gap-2">
                    {tabs.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActive(c.id)}
                        className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          active === c.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:bg-accent"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <MenuCard key={item.id} item={item} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-cocoa py-10 text-cocoa-foreground">
        <div className="mx-auto max-w-7xl px-4 text-xs text-cocoa-foreground/60 sm:px-6">
          © {new Date().getFullYear()} {restaurant.name}
        </div>
      </footer>

      <TenantOrderDrawer restaurantName={restaurant.name} whatsappPhone={restaurant.whatsapp_phone ?? restaurant.phone} />
    </div>
  );
}
