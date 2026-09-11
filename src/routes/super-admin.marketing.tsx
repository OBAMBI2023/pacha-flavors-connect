import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase-any";
import { MarketingContext, type MarketingRestaurantOption } from "@/hooks/useMarketingContext";

export const Route = createFileRoute("/super-admin/marketing")({
  ssr: false,
  component: MarketingLayout,
});

type RestaurantOption = MarketingRestaurantOption;

const SUB_NAV = [
  { to: "/super-admin/marketing", label: "Vue d'ensemble", exact: true },
  { to: "/super-admin/marketing/campagnes", label: "Campagnes" },
  { to: "/super-admin/marketing/campagnes/nouvelle", label: "Créer une campagne" },
  { to: "/super-admin/marketing/audiences", label: "Audiences" },
] as const;

function MarketingLayout() {
  const matchRoute = useMatchRoute();
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("restaurants")
      .select("id,name,slug,currency")
      .eq("status", "active")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) {
          const rows = (data ?? []) as RestaurantOption[];
          setRestaurants(rows);
          setRestaurantId((current) => current ?? rows[0]?.id ?? null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const restaurant = restaurants.find((r) => r.id === restaurantId) ?? null;

  return (
    <MarketingContext.Provider value={{ restaurants, restaurantId, setRestaurantId, restaurant, loading }}>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Marketing WhatsApp</h1>
          <p className="mt-1 text-sm text-slate-600">
            Créez, envoyez et analysez vos campagnes WhatsApp pour booster les commandes des restaurants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={restaurantId ?? ""}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="h-11 min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          >
            {restaurants.length === 0 && <option value="">Aucun restaurant actif</option>}
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SUB_NAV.map((item) => {
            const active = Boolean(matchRoute({ to: item.to, fuzzy: !("exact" in item && item.exact) }));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : !restaurantId ? (
            <p className="text-sm text-slate-500">Aucun restaurant actif à cibler pour le moment.</p>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </MarketingContext.Provider>
  );
}
