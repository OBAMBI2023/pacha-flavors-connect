import { ArrowRight, Plus } from "lucide-react";
import type { MenuItem } from "@/data/menu";

function scrollToMenu() {
  document.getElementById("carte")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function PopularCard({ item, onOpen }: { item: MenuItem; onOpen: (item: MenuItem) => void }) {
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
      className={`w-[155px] shrink-0 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_3px_12px_rgba(0,0,0,0.06)] ${item.available ? "cursor-pointer" : "cursor-not-allowed opacity-90"}`}
    >
      <div className="relative h-[105px] bg-[#F5F5F5]">
        {item.image ? <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-stone-200 to-stone-300" />}
        <span className="absolute left-2 top-2 rounded-full bg-[#F5A900] px-2 py-0.5 text-[10px] font-bold text-[#111111]">Populaire</span>
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 text-sm font-bold text-[#171717]">{item.name}</h3>
        {item.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#666666]">{item.description}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-extrabold text-[#171717]">{item.price === null ? "À confirmer" : `${item.price.toLocaleString("fr-FR")} FCFA`}</span>
          {item.available && (
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#111111] text-white">
              <Plus className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function TenantPopularSection({ items, onOpen }: { items: MenuItem[]; onOpen: (item: MenuItem) => void }) {
  const featured = items.filter((item) => item.featured);
  if (featured.length === 0) return null;

  return (
    <section id="populaires" className="bg-[#F7F7F7] pt-5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-[#171717]">Plats populaires</h2>
          <button onClick={scrollToMenu} className="inline-flex items-center gap-1 text-sm font-semibold text-[#B17A00]">
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
