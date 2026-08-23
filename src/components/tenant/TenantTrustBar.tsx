import { ChefHat, Flame, Leaf, Timer } from "lucide-react";

const ITEMS = [
  { icon: Leaf, label: "Ingrédients frais", subtitle: "Sélectionnés chaque jour" },
  { icon: ChefHat, label: "Recettes maison", subtitle: "Préparées avec passion" },
  { icon: Flame, label: "Cuisson parfaite", subtitle: "Un savoir-faire authentique" },
  { icon: Timer, label: "Service rapide", subtitle: "Commande simple et rapide" },
];

export function TenantTrustBar() {
  return (
    <section className="bg-background py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm lg:grid-cols-4 lg:gap-6">
          {ITEMS.map(({ icon: Icon, label, subtitle }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <Icon className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
