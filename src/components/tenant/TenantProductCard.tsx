import { Heart, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { formatPrice, type MenuItem } from "@/data/menu";
import { useCart } from "@/lib/cart";
import { useMenuFavorites } from "@/lib/menu-favorites";

export function TenantProductCard({
  item,
  onOpen,
  onAdd,
}: {
  item: MenuItem;
  onOpen: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}) {
  const { openCart } = useCart();
  const { favorites, toggle } = useMenuFavorites();
  const isFavorite = favorites.includes(item.id);

  function addAndOpenCart() {
    onAdd(item);
    openCart();
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="block h-full w-full text-left"
          aria-label={`Voir ${item.name}`}
        >
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              decoding="async"
              width={900}
              height={675}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-muted">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </button>
        {item.featured && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-foreground shadow-sm">
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
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <button type="button" onClick={() => onOpen(item)} className="flex-1 text-left">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 font-display text-xl font-semibold leading-tight sm:text-2xl">
              {item.name}
            </h3>
            {!item.available && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Indisponible
              </span>
            )}
          </div>
          {item.subtitle && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              {item.subtitle}
            </p>
          )}
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        </button>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="font-display text-lg font-semibold text-foreground">
            {formatPrice(item.price)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!item.available}
              onClick={addAndOpenCart}
              aria-label="Commander"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-accent disabled:opacity-40 sm:hidden"
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!item.available}
              onClick={addAndOpenCart}
              className="hidden items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40 sm:inline-flex"
            >
              Commander
            </button>
            <button
              type="button"
              disabled={!item.available}
              onClick={() => onAdd(item)}
              aria-label={`Ajouter ${item.name} au panier`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:opacity-90 active:scale-90 disabled:opacity-40 sm:hidden"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!item.available}
              onClick={() => onAdd(item)}
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
