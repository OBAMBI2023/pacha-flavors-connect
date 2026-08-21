import { Phone, MessageCircle, CalendarClock, Info, Truck, Navigation, Sun, Moon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SITE, mapsDirectionsUrl, whatsappUrl } from "@/data/site";
import { useTheme } from "@/lib/theme";

const LINKS = [
  { href: "#reservation", label: "Réserver une table", icon: CalendarClock },
  { href: "#livraison", label: "Livraison", icon: Truck },
  { href: "#a-propos", label: "À propos", icon: Info },
];

export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { theme, toggle } = useTheme();

  function go(href: string) {
    onOpenChange(false);
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Plus d'options</SheetTitle>
        </SheetHeader>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium hover:bg-accent"
          >
            <span className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
              Thème {theme === "dark" ? "sombre" : "clair"}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Passer en {theme === "dark" ? "clair" : "sombre"}
            </span>
          </button>
          <a
            href={`tel:${SITE.phoneTel}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium hover:bg-accent"
          >
            <Phone className="h-5 w-5 text-primary" /> Appeler le restaurant
          </a>
          <a
            href={whatsappUrl("Bonjour LE PACHA")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium hover:bg-accent"
          >
            <MessageCircle className="h-5 w-5 text-primary" /> WhatsApp
          </a>
          <a
            href={mapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium hover:bg-accent"
          >
            <Navigation className="h-5 w-5 text-primary" /> Itinéraire
          </a>
          {LINKS.map(({ href, label, icon: Icon }) => (
            <button
              key={href}
              type="button"
              onClick={() => go(href)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left text-sm font-medium hover:bg-accent"
            >
              <Icon className="h-5 w-5 text-primary" /> {label}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
