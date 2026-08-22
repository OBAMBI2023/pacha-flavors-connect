import { Plus } from "lucide-react";
import type { MenuItem } from "@/data/menu";

export function TenantProductCard({ item, onOpen }: { item: MenuItem; onOpen: (item: MenuItem) => void }) {
  function open() {
    if (item.available) onOpen(item);
  }

  return (
    <article
      role="button"
      tabIndex={item.available ? 0 : -1}
      aria-disabled={!item.available}
      aria-label={item.available ? `Voir ${item.name}` : `${item.name} indisponible`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={`group overflow-hidden rounded-[28px] border border-border bg-card shadow-sm transition-transform duration-300 ${
        item.available ? "cursor-pointer hover:-translate-y-1" : "cursor-not-allowed opacity-90"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {item.image ? (
          <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-200 to-stone-300" />
        )}
        {item.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-foreground shadow-sm">
            Populaire
          </span>
        )}
        {item.available && (
          <span
            aria-hidden="true"
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-background/90 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105"
          >
            <Plus className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 font-semibold">{item.name}</h3>
          {item.available ? (
            <span className="shrink-0 text-sm font-semibold text-primary">{item.price === null ? "À confirmer" : `${item.price.toLocaleString("fr-FR")} FCFA`}</span>
          ) : (
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Indisponible</span>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
      </div>
    </article>
  );
}
