import { Plus, UtensilsCrossed } from "lucide-react";
import { formatPrice, type MenuItem } from "@/data/menu";

export function TenantProductCard({
  item,
  onOpen,
  onAdd,
}: {
  item: MenuItem;
  onOpen: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-muted text-left"
        aria-label={`Voir ${item.name}`}
      >
        {item.featured && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-gold px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-foreground shadow-sm">
            Populaire
          </span>
        )}
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
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <button type="button" onClick={() => onOpen(item)} className="text-left">
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
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-display text-lg font-semibold text-foreground">
            {formatPrice(item.price)}
          </span>
          <button
            disabled={!item.available}
            onClick={() => onAdd(item)}
            aria-label={`Ajouter ${item.name} au panier`}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>
    </article>
  );
}
