import { ChefHat, Flame, Leaf, Timer } from "lucide-react";

const ITEMS = [
  { icon: Leaf, label: "Ingrédients frais", subtitle: "Sélectionnés chaque jour" },
  { icon: ChefHat, label: "Recettes maison", subtitle: "Préparées avec passion" },
  { icon: Flame, label: "Cuisson parfaite", subtitle: "Un savoir-faire authentique" },
  { icon: Timer, label: "Service rapide", subtitle: "Commande simple et rapide" },
];

export function TenantTrustBar() {
  return (
    <section className="bg-cocoa py-10 text-cocoa-foreground">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:px-6 lg:grid-cols-4 lg:gap-8">
        {ITEMS.map(({ icon: Icon, label, subtitle }) => (
          <div key={label} className="flex flex-col items-center gap-2 text-center">
            <Icon className="h-6 w-6 text-gold" />
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-cocoa-foreground/60">{subtitle}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
