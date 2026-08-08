import heroImg from "@/assets/hero.jpg";
import { useCart } from "@/lib/cart";

const POINTS = ["Produits frais", "Cuisine authentique", "Livraison disponible"];

export function Hero() {
  const { openCart } = useCart();

  return (
    <section id="accueil" className="relative overflow-hidden bg-cocoa text-cocoa-foreground">
      <img
        src={heroImg}
        alt="Plat généreux du restaurant Le Pacha à Angré 8e Tranche"
        width={1600}
        height={1200}
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cocoa/85 via-cocoa/70 to-cocoa/95" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:py-36">
        <div className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-gold">
            Restaurant • Angré 8e Tranche
          </p>
          <h1 className="mt-5 text-balance-title font-display text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
            Les saveurs authentiques, préparées avec passion.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-cocoa-foreground/80 sm:text-lg">
            Découvrez une cuisine généreuse au cœur d'Angré 8e Tranche. Sur place, à emporter
            ou en livraison.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={openCart}
              className="rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
            >
              Commander maintenant
            </button>
            <a
              href="#carte"
              className="rounded-full border border-cocoa-foreground/30 px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-cocoa-foreground/10"
            >
              Voir le menu
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-cocoa-foreground/75">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="text-gold">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}