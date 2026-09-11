import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Compass, MapPin, ShoppingBag, Wallet } from "lucide-react";
import { fetchSuperAdminCustomerMap, type CustomerMapResult, type ZoneStat } from "@/lib/superAdminCustomerMap";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/super-admin/zones-opportunites")({
  ssr: false,
  component: SuperAdminZonesPage,
});

const EMPTY: CustomerMapResult = {
  customers: [],
  kpis: { geolocated: 0, zones_covered: 0, total_orders: 0, total_revenue: 0 },
  zones: [],
};

/** Minimum sample size before a zone's orders/customer ratio is trusted -- one or two customers isn't enough to call a zone "sous-exploitée" either way. */
const MIN_SAMPLE = 3;

type ZoneWithRatio = ZoneStat & { orders_per_customer: number };

function withRatio(zones: ZoneStat[]): ZoneWithRatio[] {
  return zones.map((z) => ({ ...z, orders_per_customer: z.customers_count > 0 ? z.orders_count / z.customers_count : 0 }));
}

function SuperAdminZonesPage() {
  const [result, setResult] = useState<CustomerMapResult>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // No filters: every geolocated customer across every tenant, all time --
    // same RPC and same "zone" derivation (delivery_neighborhood / commune /
    // city on a real order) already powering Carte géographique > Clients.
    fetchSuperAdminCustomerMap({})
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger les zones.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byConcentration = useMemo(() => [...result.zones].sort((a, b) => b.customers_count - a.customers_count), [result.zones]);
  const byActivity = useMemo(() => [...result.zones].sort((a, b) => b.total_revenue - a.total_revenue), [result.zones]);
  const underexploited = useMemo(() => {
    return withRatio(result.zones)
      .filter((z) => z.customers_count >= MIN_SAMPLE)
      .sort((a, b) => a.orders_per_customer - b.orders_per_customer)
      .slice(0, 10);
  }, [result.zones]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Zones & opportunités</h1>
        <p className="mt-1 text-sm text-slate-600">
          Basé uniquement sur les clients géolocalisés (adresse de livraison réelle), tous tenants confondus. Voir la{" "}
          <Link to="/super-admin/customer-map" className="text-cyan-700 underline">
            carte géographique
          </Link>{" "}
          pour la vue spatiale.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SuperAdminKpiCard icon={MapPin} label="Clients géolocalisés" value={result.kpis.geolocated.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={Compass} label="Zones couvertes" value={result.kpis.zones_covered.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={ShoppingBag} label="Commandes" value={result.kpis.total_orders.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={Wallet} label="CA clients" value={formatMoney(result.kpis.total_revenue, "XOF")} />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : result.zones.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Aucune zone déterminable pour le moment (pas assez de commandes géolocalisées).
        </p>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ZoneTable title="Forte concentration de clients" subtitle="Zones classées par nombre de clients géolocalisés." zones={byConcentration} highlight="customers_count" />
            <ZoneTable title="Forte activité" subtitle="Zones classées par chiffre d'affaires réel." zones={byActivity} highlight="total_revenue" />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Zones potentiellement sous-exploitées</h2>
            <p className="mt-1 text-sm text-slate-500">
              Commandes par client le plus bas parmi les zones avec au moins {MIN_SAMPLE} clients géolocalisés -- des clients présents,
              mais qui commandent peu.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Zone</th>
                      <th className="px-4 py-3">Clients</th>
                      <th className="px-4 py-3">Commandes</th>
                      <th className="px-4 py-3">Commandes / client</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {underexploited.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-slate-500" colSpan={4}>
                          Pas assez de zones avec {MIN_SAMPLE}+ clients pour ce calcul.
                        </td>
                      </tr>
                    )}
                    {underexploited.map((z) => (
                      <tr key={z.zone} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{z.zone}</td>
                        <td className="px-4 py-3 text-slate-600">{z.customers_count.toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-3 text-slate-600">{z.orders_count.toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-3 font-semibold">{z.orders_per_customer.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ZoneTable({
  title,
  subtitle,
  zones,
  highlight,
}: {
  title: string;
  subtitle: string;
  zones: ZoneStat[];
  highlight: "customers_count" | "total_revenue";
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Commandes</th>
                <th className="px-4 py-3">CA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {zones.slice(0, 8).map((z) => (
                <tr key={z.zone} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{z.zone}</td>
                  <td className={`px-4 py-3 ${highlight === "customers_count" ? "font-semibold" : "text-slate-600"}`}>{z.customers_count.toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-3 text-slate-600">{z.orders_count.toLocaleString("fr-FR")}</td>
                  <td className={`px-4 py-3 ${highlight === "total_revenue" ? "font-semibold" : "text-slate-600"}`}>{formatMoney(z.total_revenue, "XOF")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
