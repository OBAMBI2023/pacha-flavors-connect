import { useCart } from "@/lib/cart";

const STEPS = [
  { n: "01", t: "Choisissez", d: "Sélectionnez vos plats." },
  { n: "02", t: "Commandez", d: "Validez votre panier." },
  {
    n: "03",
    t: "Recevez",
    d: "Le Pacha confirme votre commande et organise la livraison.",
  },
];

export function DeliverySection() {
  const { openCart } = useCart();

  return (
    <section id="livraison" className="section-pad bg-cocoa text-cocoa-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-semibold sm:text-5xl">
            Votre repas préféré, livré chez vous.
          </h2>
          <p className="mt-4 text-cocoa-foreground/75">
            Commandez vos plats préférés et faites-vous livrer simplement à domicile ou au
            bureau.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-cocoa-foreground/15 bg-cocoa-foreground/5 p-4 sm:p-6"
            >
              <span className="font-display text-3xl font-semibold text-gold">{s.n}</span>
              <h3 className="mt-3 font-display text-2xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-cocoa-foreground/70">{s.d}</p>
            </div>
          ))}
        </div>
        <button
          onClick={openCart}
          className="mt-10 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Commander maintenant
        </button>
      </div>
    </section>
  );
}