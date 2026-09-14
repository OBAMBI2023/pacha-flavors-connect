import type { ReactNode } from "react";
import { Store } from "lucide-react";

/**
 * Guard for pages that fundamentally operate on exactly one restaurant's
 * data (audiences, campaigns, promo codes, automations) -- "Tous les
 * restaurants" has no valid meaning there, unlike Dashboard/Clients/Analytics
 * which aggregate across restaurants on purpose.
 */
export function RequireOneRestaurant({
  restaurantId,
  children,
}: {
  restaurantId: string | "all" | null;
  children: ReactNode;
}) {
  if (restaurantId === "all") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
        <Store className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm text-slate-500">
          Sélectionnez un restaurant précis pour cette section.
        </p>
      </div>
    );
  }
  if (!restaurantId) return null;
  return <>{children}</>;
}
