import { Heart, Plus, ShoppingBag } from "lucide-react";
import { formatPrice, type MenuItem } from "@/data/menu";
import { useCart } from "@/lib/cart";
import { useMenuFavorites } from "@/lib/menu-favorites";

export function MenuCard({ item, onOpen }: { item: MenuItem; onOpen?: (item: MenuItem) => void }) {
  const { add, openCart } = useCart();
  const { favorites, toggle } = useMenuFavorites();
  const isFavorite = favorites.includes(item.id);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {item.image && (
        <div className="relative aspect-square w-full overflow-hidden bg-muted sm:aspect-[4/3]">
          <button
            type="button"
            onClick={() => onOpen?.(item)}
            aria-label={`Voir ${item.name}`}
            className="block h-full w-full text-left"
          >
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              width={900}
              height={900}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
          {item.featured && (
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-primary-foreground">
              Populaire
            </span>
          )}
          <button
            type="button"
            onClick={() => toggle(item.id)}
            aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={isFavorite}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-transform active:scale-90"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-primary text-primary" : "text-foreground/70"}`} />
          </button>
        </div>
      )}
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <button type="button" onClick={() => onOpen?.(item)} className="flex-1 text-left">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 font-display text-base font-semibold leading-tight sm:text-2xl">
              {item.name}
            </h3>
            {!item.available && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
                Indisponible
              </span>
            )}
          </div>
          {item.subtitle && (
            <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-primary sm:text-xs">
              {item.subtitle}
            </p>
          )}
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:mt-3 sm:text-sm">
            {item.description}
          </p>
        </button>
        <div className="mt-3 flex items-center justify-between gap-2 sm:mt-5 sm:flex-wrap">
          <span className="font-display text-sm font-semibold text-foreground sm:text-lg">
            {formatPrice(item.price)}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={!item.available}
              onClick={() => {
                add(item);
                openCart();
              }}
              aria-label="Commander"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-accent disabled:opacity-40 sm:hidden"
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
            <button
              disabled={!item.available}
              onClick={() => {
                add(item);
                openCart();
              }}
              className="hidden items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40 sm:inline-flex"
            >
              Commander
            </button>
            <button
              disabled={!item.available}
              onClick={() => add(item)}
              aria-label="Ajouter au panier"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:opacity-90 active:scale-90 disabled:opacity-40 sm:hidden"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              disabled={!item.available}
              onClick={() => add(item)}
              className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 sm:inline-flex"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}