import { MapPin, Phone } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import { useCart } from "@/lib/cart";
import { SITE } from "@/data/site";

const POINTS = ["Produits frais", "Cuisine authentique", "Livraison disponible"];

export function Hero() {
  const { openCart } = useCart();

  return (
    <section id="accueil" className="bg-background pt-4 lg:bg-cocoa lg:pt-0">
      <div className="relative mx-4 overflow-hidden rounded-3xl bg-cocoa text-cocoa-foreground lg:mx-0 lg:rounded-none">
        <img
          src={heroImg}
          alt="Plat généreux du restaurant Le Pacha à Angré 8e Tranche"
          width={1600}
          height={1200}
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-cocoa/85 via-cocoa/70 to-cocoa/95" />
        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 md:py-28 lg:py-36">
          <div className="max-w-2xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-gold">
              Bienvenue chez
            </p>
            <h1 className="mt-3 text-balance-title font-display text-3xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              Les saveurs authentiques, préparées avec passion.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-cocoa-foreground/80 sm:text-lg">
              Découvrez une cuisine généreuse au cœur d'Angré 8e Tranche. Sur place, à emporter
              ou en livraison.
            </p>

            <div className="mt-5 space-y-2 text-sm text-cocoa-foreground/80">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-gold" />
                <span>
                  {SITE.address.line1}, {SITE.address.line2}
                </span>
              </div>
              <a href={`tel:${SITE.phoneTel}`} className="flex items-center gap-2 hover:text-cocoa-foreground">
                <Phone className="h-4 w-4 shrink-0 text-gold" />
                <span>{SITE.phoneDisplay}</span>
              </a>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                onClick={openCart}
                className="rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-gold-foreground shadow-lg transition-opacity hover:opacity-90 sm:w-auto"
              >
                Commander maintenant
              </button>
              <a
                href="#carte"
                className="rounded-full border border-cocoa-foreground/30 px-7 py-3.5 text-center text-sm font-semibold transition-colors hover:bg-cocoa-foreground/10 sm:w-auto"
              >
                Voir le menu
              </a>
            </div>
            <ul className="mt-8 hidden flex-wrap gap-x-6 gap-y-2 text-sm text-cocoa-foreground/75 sm:flex">
              {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="text-gold">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}