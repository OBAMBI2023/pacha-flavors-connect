import { DAILY_MENU } from "@/data/menu";
import { MenuCard } from "./MenuCard";

export function DailyMenu() {
  return (
    <section id="menu-du-jour" className="section-pad bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
          Aujourd'hui au Pacha
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Menu du jour</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DAILY_MENU.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}