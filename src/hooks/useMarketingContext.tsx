import { createContext, useContext } from "react";

export type MarketingRestaurantOption = { id: string; name: string; slug: string; currency: string };

export type MarketingContextValue = {
  restaurants: MarketingRestaurantOption[];
  restaurantId: string | null;
  setRestaurantId: (id: string) => void;
  restaurant: MarketingRestaurantOption | null;
  loading: boolean;
};

// Deliberately NOT defined inside a route file: TanStack Router's
// code-splitter pulls each route's `component` into its own lazy chunk, and
// any other export sitting in that same file (this Context, this hook) can
// end up duplicated across the layout's chunk and a child route's chunk --
// two different Context object identities, so a child's useContext() never
// sees the layout's Provider. A plain, non-route module guarantees every
// importer resolves to the exact same instance.
export const MarketingContext = createContext<MarketingContextValue | null>(null);

export function useMarketingContext(): MarketingContextValue {
  const ctx = useContext(MarketingContext);
  if (!ctx) throw new Error("useMarketingContext must be used within the /super-admin/marketing layout");
  return ctx;
}
