import { ChevronRight, MapPin } from "lucide-react";
import { useDeliveryLocation } from "@/lib/deliveryLocation";

export function TenantLocationBar() {
  const { location, openModal } = useDeliveryLocation();
  const shortAddress = location ? [location.neighborhood, location.commune, location.city].filter(Boolean).join(", ") || location.address : null;

  return (
    <button
      type="button"
      onClick={openModal}
      aria-label="Adresse de livraison"
      className="mx-4 mt-2 flex w-[calc(100%-2rem)] items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-accent sm:mx-6 sm:w-[calc(100%-3rem)]"
    >
      <MapPin className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Livrer à</p>
        <p className="truncate text-sm font-semibold text-foreground">{shortAddress ?? "Définir votre adresse de livraison"}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
