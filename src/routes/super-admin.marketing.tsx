import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MarketingContext, type MarketingRestaurantOption } from "@/hooks/useMarketingContext";
import { CRM_NAV_ITEMS } from "@/components/superadmin/marketing/crmNav";

export const Route = createFileRoute("/super-admin/marketing")({
  ssr: false,
  component: MarketingLayout,
});

type RestaurantOption = MarketingRestaurantOption;

function MarketingLayout() {
  const matchRoute = useMatchRoute();
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | "all" | null>(null);
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

  const restaurant =
    restaurantId && restaurantId !== "all"
      ? (restaurants.find((r) => r.id === restaurantId) ?? null)
      : null;

  return (
    <MarketingContext.Provider
      value={{ restaurants, restaurantId, setRestaurantId, restaurant, loading }}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
              CRM Marketing WhatsApp
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Transformez vos clients en clients réguliers grâce à WhatsApp, aux segments
              intelligents et au marketing personnalisé.
            </p>
          </div>
          <Link
            to="/super-admin/marketing/campagnes/nouvelle"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Nouvelle campagne
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={restaurantId ?? ""}
            onChange={(e) => setRestaurantId(e.target.value === "all" ? "all" : e.target.value)}
            className="h-11 min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          >
            {restaurants.length === 0 && <option value="">Aucun restaurant actif</option>}
            {restaurants.length > 0 && <option value="all">Tous les restaurants</option>}
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
          <nav className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:rounded-3xl lg:border lg:border-slate-200 lg:bg-white lg:p-2 lg:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden">
            {CRM_NAV_ITEMS.map((item) => {
              const active = Boolean(matchRoute({ to: item.to, fuzzy: !item.exact }));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors lg:rounded-2xl lg:border-0 lg:px-3 lg:py-2.5 ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:bg-transparent lg:hover:bg-slate-50"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {loading ? (
              <p className="text-sm text-slate-500">Chargement...</p>
            ) : !restaurantId ? (
              <p className="text-sm text-slate-500">
                Aucun restaurant actif à cibler pour le moment.
              </p>
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </div>
    </MarketingContext.Provider>
  );
}
