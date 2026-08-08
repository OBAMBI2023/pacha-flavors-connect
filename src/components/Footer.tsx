import { SITE } from "@/data/site";

export function Footer() {
  return (
    <footer className="bg-cocoa pb-24 pt-14 text-cocoa-foreground lg:pb-14">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-semibold tracking-wide">LE PACHA</p>
          <p className="mt-3 max-w-xs text-sm text-cocoa-foreground/70">
            Cuisine authentique et généreuse à Angré 8e Tranche. Sur place, à emporter ou en
            livraison.
          </p>
        </div>
        <div className="text-sm text-cocoa-foreground/70">
          <p className="font-semibold text-cocoa-foreground">Adresse</p>
          <p className="mt-2">
            {SITE.address.line1}
            <br />
            {SITE.address.line2}
            <br />
            {SITE.address.city}
          </p>
        </div>
        <div className="text-sm text-cocoa-foreground/70">
          <p className="font-semibold text-cocoa-foreground">Contact</p>
          <a href={`tel:${SITE.phoneTel}`} className="mt-2 block hover:text-gold">
            {SITE.phoneDisplay}
          </a>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl px-4 text-xs text-cocoa-foreground/50 sm:px-6">
        © {new Date().getFullYear()} Le Pacha Restaurant — Abidjan, Côte d'Ivoire.
      </div>
    </footer>
  );
}