import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, ShoppingBag, Wallet, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchTenants, type TenantRow } from "@/lib/superAdminTenants";
import { fetchSuperAdminOrders, type SuperAdminOrdersResult, type SuperAdminOrderRow } from "@/lib/superAdminOrders";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/components/admin/orders/orderStatusMeta";
import type { OrderStatus } from "@/lib/orders-db";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/super-admin/commandes")({
  ssr: false,
  component: SuperAdminCommandesPage,
});

const PERIOD_FILTERS: { value: number | "all"; label: string }[] = [
  { value: "all", label: "Toute période" },
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
];

const EMPTY_RESULT: SuperAdminOrdersResult = {
  orders: [],
  total_count: 0,
  page: 0,
  page_size: 50,
  kpis: { today: 0, in_progress: 0, delivered: 0, cancelled: 0, revenue: 0 },
};

function SuperAdminCommandesPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [restaurantId, setRestaurantId] = useState<string>("all");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [periodDays, setPeriodDays] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<SuperAdminOrdersResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenants()
      .then(setTenants)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Impossible de charger les tenants."));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [restaurantId, status, periodDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSuperAdminOrders({
      restaurantId: restaurantId === "all" ? null : restaurantId,
      status: status === "all" ? null : status,
      periodDays: periodDays === "all" ? null : periodDays,
      search: debouncedSearch || null,
      page,
      pageSize: 50,
    })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger les commandes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, status, periodDays, debouncedSearch, page]);

  const activeTenants = useMemo(() => tenants.filter((t) => t.status !== "archived"), [tenants]);
  const revenueCurrency = result.orders[0]?.currency ?? "XOF";
  const totalPages = Math.max(1, Math.ceil(result.total_count / result.page_size));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Commandes</h1>
        <p className="mt-1 text-sm text-slate-600">Commandes de la plateforme, tous tenants confondus.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SuperAdminKpiCard icon={CalendarClock} label="Aujourd'hui" value={result.kpis.today.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={ShoppingBag} label="En cours" value={result.kpis.in_progress.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={CheckCircle2} label="Livrées" value={result.kpis.delivered.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={XCircle} label="Annulées" value={result.kpis.cancelled.toLocaleString("fr-FR")} />
        <SuperAdminKpiCard icon={Wallet} label="CA" value={formatMoney(result.kpis.revenue, revenueCurrency)} />
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="h-11 min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          >
            <option value="all">Tous les tenants</option>
            {activeTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus | "all")}
            className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          >
            <option value="all">Tous les statuts</option>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client ou n° commande..." className="h-11 rounded-xl border-slate-200 text-sm shadow-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PERIOD_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setPeriodDays(f.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                periodDays === f.value ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Livreur</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Créée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Chargement...
                  </td>
                </tr>
              )}
              {!loading && result.orders.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Aucune commande pour ces filtres.
                  </td>
                </tr>
              )}
              {!loading &&
                result.orders.map((order: SuperAdminOrderRow) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{order.restaurant_name}</td>
                    <td className="px-4 py-3 text-slate-600">#{order.order_number}</td>
                    <td className="px-4 py-3 text-slate-600">{order.customer_name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${STATUS_BADGE_CLASS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.assigned_driver_name ?? "-"}</td>
                    <td className="px-4 py-3 font-semibold">{formatMoney(order.total_amount, order.currency)}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(order.created_at).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <p>
            {result.total_count.toLocaleString("fr-FR")} commande{result.total_count > 1 ? "s" : ""} -- page {page + 1} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Précédent
            </Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
