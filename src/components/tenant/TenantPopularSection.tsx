import { ArrowRight, Minus, Plus } from "lucide-react";
import { useCart, computeLineKey } from "@/lib/cart";
import type { MenuItem } from "@/data/menu";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function PopularCard({ item, onOpen }: { item: MenuItem; onOpen: (item: MenuItem) => void }) {
  const { lines, add, increment, decrement } = useCart();

  function open() {
    if (item.available) onOpen(item);
  }

  const hasOptions = (item.optionGroups ?? []).length > 0;
  const lineKey = computeLineKey(item.id, []);
  const qty = !hasOptions ? (lines.find((l) => l.key === lineKey)?.qty ?? 0) : 0;

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.available) return;
    if (hasOptions) {
      onOpen(item);
      return;
    }
    add(item, 1);
  }

  function handleIncrement(e: React.MouseEvent) {
    e.stopPropagation();
    increment(lineKey);
  }

  function handleDecrement(e: React.MouseEvent) {
    e.stopPropagation();
    decrement(lineKey);
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
      className={`w-[155px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${item.available ? "cursor-pointer" : "cursor-not-allowed opacity-90"}`}
    >
      <div className="relative h-[105px] bg-muted">
        {item.image ? <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-stone-200 to-stone-300" />}
        <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">Populaire</span>
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 text-sm font-bold text-foreground">{item.name}</h3>
        {item.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.description}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-extrabold text-foreground">{item.price === null ? "À confirmer" : `${item.price.toLocaleString("fr-FR")} FCFA`}</span>
          {item.available &&
            (qty > 0 ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-0.5 py-0.5">
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label="Retirer un article"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="min-w-2.5 text-center text-xs font-bold">{qty}</span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  aria-label="Ajouter un article"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:opacity-90"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleQuickAdd}
                aria-label={`Ajouter ${item.name} au panier`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4" />
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}

export function TenantPopularSection({ items, onOpen }: { items: MenuItem[]; onOpen: (item: MenuItem) => void }) {
  const featured = items.filter((item) => item.featured);
  if (featured.length === 0) return null;

  return (
    <section id="populaires" className="bg-background pt-5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-foreground">Plats populaires</h2>
          <button onClick={scrollToMenu} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Voir tout <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2.5">
            {featured.map((item) => (
              <PopularCard key={item.id} item={item} onOpen={onOpen} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
