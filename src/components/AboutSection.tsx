import grillades from "@/assets/grillades.jpg";

const HIGHLIGHTS = [
  "Produits frais",
  "Cuisine authentique",
  "Préparation avec passion",
  "Livraison disponible",
  "Service chaleureux",
];

export function AboutSection() {
  return (
    <section id="a-propos" className="section-pad bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl">
          <img
            src={grillades}
            alt="Grillades préparées au feu de bois au restaurant Le Pacha"
            loading="lazy"
            width={900}
            height={900}
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
            Notre maison
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
            Bienvenue au Pacha
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            LE PACHA vous propose une cuisine authentique, généreuse et préparée avec passion.
            Nous sélectionnons des produits frais pour vous faire découvrir des plats riches en
            saveurs, sur place, à emporter ou en livraison.
          </p>
          <ul className="mt-7 flex flex-wrap gap-2">
            {HIGHLIGHTS.map((h) => (
              <li
                key={h}
                className="rounded-full border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-medium text-gold-foreground"
              >
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}