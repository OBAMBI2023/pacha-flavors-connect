import type { SuperAdminTenantRankingRow } from "@/lib/superAdminRevenueAnalytics";
import { formatMoney } from "@/lib/currency";

export function TenantRankingTable({ rows }: { rows: SuperAdminTenantRankingRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">Aucune commande sur cette période.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Commandes</th>
              <th className="px-4 py-3">Panier moyen</th>
              <th className="px-4 py-3">CA (livré)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, index) => (
              <tr key={row.restaurant_id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                <td className="px-4 py-3 font-medium">{row.restaurant_name}</td>
                <td className="px-4 py-3 text-slate-600">{row.orders_count.toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-slate-600">{row.average_order_value != null ? formatMoney(row.average_order_value, row.currency) : "-"}</td>
                <td className="px-4 py-3 font-semibold">{formatMoney(row.revenue, row.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
