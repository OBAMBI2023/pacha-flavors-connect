import { Plus } from "lucide-react";
import { formatPrice, type MenuItem } from "@/data/menu";
import { useCart } from "@/lib/cart";

export function MenuCard({ item }: { item: MenuItem }) {
  const { add, openCart } = useCart();

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {item.image && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            width={900}
            height={900}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-display text-2xl font-semibold leading-tight">
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
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {item.description}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="font-display text-lg font-semibold text-foreground">
            {formatPrice(item.price)}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={!item.available}
              onClick={() => add(item)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
            <button
              disabled={!item.available}
              onClick={() => {
                add(item);
                openCart();
              }}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40"
            >
              Commander
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}