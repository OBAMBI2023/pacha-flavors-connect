import { Bike, ChevronsRight, Gift } from "lucide-react";

export function PromoBanner() {
  return (
    <div className="relative flex h-[13rem] max-h-64 items-center justify-center overflow-hidden rounded-[1.75rem] bg-gold px-6 text-center text-cocoa">
      <Bike className="absolute -left-2 bottom-4 h-20 w-20 text-cocoa/25" strokeWidth={1.25} aria-hidden />
      <Gift className="absolute -right-2 top-4 h-16 w-16 text-cocoa/25" strokeWidth={1.25} aria-hidden />

      <div className="max-w-[16rem]">
        <p className="text-sm font-semibold text-cocoa/70">Nos restaurants partenaires</p>
        <p className="mt-1 text-xl font-bold leading-tight">Livraison gratuite sur les commandes éligibles</p>
      </div>

      <span className="absolute right-5 top-1/2 flex h-[3.375rem] w-[3.375rem] -translate-y-1/2 items-center justify-center rounded-full bg-cocoa text-cocoa-foreground shadow-md">
        <ChevronsRight className="h-6 w-6" />
      </span>
    </div>
  );
}
