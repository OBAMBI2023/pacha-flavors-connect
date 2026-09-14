import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchCustomers, type Customer } from "@/lib/customers-db";
import { formatMoney } from "@/lib/currency";
import {
  CUSTOMER_CRM_SEGMENT_BADGE_CLASS,
  CUSTOMER_CRM_SEGMENT_LABELS,
  CUSTOMER_LIFECYCLE_BADGE_CLASS,
  CUSTOMER_LIFECYCLE_LABELS,
  customerCrmSegment,
  customerLifecycleStatus,
  type CustomerCrmSegment,
} from "@/lib/marketing";
import { useMarketingContext } from "@/hooks/useMarketingContext";
import { CrmCustomerDetailSheet } from "@/components/superadmin/marketing/CrmCustomerDetailSheet";

export const Route = createFileRoute("/super-admin/marketing/clients")({
  ssr: false,
  component: MarketingClientsPage,
});

const SEGMENT_FILTERS: { value: CustomerCrmSegment | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "vip", label: "VIP" },
  { value: "regular", label: "Réguliers" },
  { value: "new_customer", label: "Nouveaux" },
  { value: "high_value", label: "Forte valeur" },
  { value: "standard", label: "Standard" },
];

function toCsv(rows: Customer[], restaurantName: (id: string) => string): string {
  const header = [
    "Nom",
    "Téléphone",
    "Restaurant",
    "Commandes",
    "CA total",
    "Dernière commande",
    "Segment",
    "Statut",
  ];
  const lines = rows.map((c) =>
    [
      c.full_name,
      c.phone,
      restaurantName(c.restaurant_id),
      c.orders_count,
      c.total_spent,
      c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("fr-FR") : "",
      CUSTOMER_CRM_SEGMENT_LABELS[customerCrmSegment(c)],
      CUSTOMER_LIFECYCLE_LABELS[customerLifecycleStatus(c)],
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function MarketingClientsPage() {
  const { restaurantId, restaurants, restaurant } = useMarketingContext();
  const scopeId = restaurantId === "all" ? null : restaurantId;
  const currency = restaurant?.currency ?? "XOF";
  const restaurantNameById = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r.name])),
    [restaurants],
  );

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<CustomerCrmSegment | "all">("all");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(
      () => {
        fetchCustomers(scopeId, { search, page })
          .then(({ customers: rows, total: count }) => {
            if (cancelled) return;
            setCustomers(rows);
            setTotal(count);
          })
          .catch((err: unknown) => {
            if (!cancelled)
              toast.error(
                err instanceof Error ? err.message : "Impossible de charger les clients.",
              );
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      search ? 300 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [scopeId, search, page]);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const visible =
    segmentFilter === "all"
      ? customers
      : customers.filter((c) => customerCrmSegment(c) === segmentFilter);

  function exportCsv() {
    const csv = toCsv(visible, (id) => restaurantNameById.get(id) ?? "--");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-crm-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {segmentFilter === "all" ? (
            <>
              {total} client{total > 1 ? "s" : ""}
              {scopeId === null ? " sur tous les restaurants actifs" : ""}
            </>
          ) : (
            <>
              {visible.length} sur cette page correspondent à ce segment ({total} au total)
            </>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exporter (CSV)
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SEGMENT_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setSegmentFilter(f.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              segmentFilter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Rechercher par nom, téléphone ou email..."
          className="h-11 pl-9"
        />
      </div>

      {loading && customers.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Chargement...</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Aucun client ne correspond à cette vue.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Téléphone</th>
                {scopeId === null && <th className="px-4 py-3">Restaurant</th>}
                <th className="px-4 py-3 text-right">Commandes</th>
                <th className="px-4 py-3 text-right">CA total</th>
                <th className="px-4 py-3 text-right">Panier moyen</th>
                <th className="px-4 py-3">Dernière commande</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((c) => {
                const segment = customerCrmSegment(c);
                const lifecycle = customerLifecycleStatus(c);
                const avgBasket = c.orders_count > 0 ? c.total_spent / c.orders_count : 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                    {scopeId === null && (
                      <td className="px-4 py-3 text-slate-600">
                        {restaurantNameById.get(c.restaurant_id) ?? "--"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-slate-600">{c.orders_count}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatMoney(c.total_spent, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatMoney(avgBasket, currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.last_order_at
                        ? new Date(c.last_order_at).toLocaleDateString("fr-FR")
                        : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={CUSTOMER_CRM_SEGMENT_BADGE_CLASS[segment]}>
                        {CUSTOMER_CRM_SEGMENT_LABELS[segment]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={CUSTOMER_LIFECYCLE_BADGE_CLASS[lifecycle]}>
                        {CUSTOMER_LIFECYCLE_LABELS[lifecycle]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailId(c.id)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Précédent
          </Button>
          <span className="text-xs text-slate-500">
            Page {page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      <CrmCustomerDetailSheet
        customerId={detailId}
        currency={currency}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
