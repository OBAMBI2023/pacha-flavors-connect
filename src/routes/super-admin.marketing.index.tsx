import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Send, ShoppingBag, Users, Wallet } from "lucide-react";
import { StatCard } from "@/components/admin/stats/StatCard";
import { formatMoney } from "@/lib/currency";
import { fetchMarketingOverview, type MarketingOverview } from "@/lib/marketing";
import { useMarketingContext } from "@/hooks/useMarketingContext";

export const Route = createFileRoute("/super-admin/marketing/")({
  ssr: false,
  component: MarketingOverviewPage,
});

function MarketingOverviewPage() {
  const { restaurantId, restaurant } = useMarketingContext();
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setLoading(true);
    fetchMarketingOverview(restaurantId)
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const currency = restaurant?.currency ?? "XOF";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Chiffres réels de <span className="font-medium text-slate-900">{restaurant?.name ?? "—"}</span>. Aucune donnée fictive :
          les statuts « livré »/« lu » et le coût par message nécessitent une API WhatsApp Business, pas encore branchée sur ce
          projet -- ils n'apparaissent pas tant qu'elle ne l'est pas.
        </p>
        <Link
          to="/super-admin/marketing/campagnes/nouvelle"
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          Créer une campagne
        </Link>
      </div>

      {loading || !overview ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Send} label="Campagnes créées" value={String(overview.campaignsCount)} />
          <StatCard icon={Users} label="Clients ciblés (cumulé)" value={String(overview.recipientsTargeted)} />
          <StatCard icon={MessageCircle} label="Messages envoyés" value={String(overview.messagesSent)} hint="Confirmés manuellement par l'équipe" />
          <StatCard icon={Users} label="Clients uniques atteints" value={String(overview.uniqueClientsReached)} />
          <StatCard icon={ShoppingBag} label="Commandes générées" value={String(overview.ordersGenerated)} hint="Via code promo de campagne" />
          <StatCard icon={Wallet} label="Chiffre d'affaires généré" value={formatMoney(overview.revenueGenerated, currency)} hint="Commandes attribuées uniquement" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/super-admin/marketing/campagnes/nouvelle" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Créer une campagne
        </Link>
        <Link to="/super-admin/marketing/audiences" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Explorer les audiences
        </Link>
        <Link to="/super-admin/marketing/campagnes" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Voir les campagnes
        </Link>
      </div>
    </div>
  );
}
