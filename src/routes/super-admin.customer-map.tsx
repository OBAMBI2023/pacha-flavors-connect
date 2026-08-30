import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Compass, MapPin, Search, ShoppingBag, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchTenants, type TenantRow } from "@/lib/superAdminTenants";
import {
  fetchSuperAdminCustomerMap,
  CUSTOMER_MAP_STATUS_LABELS,
  CUSTOMER_MAP_STATUS_COLOR,
  type CustomerMapResult,
  type CustomerMapStatus,
  type MappedCustomer,
} from "@/lib/superAdminCustomerMap";
import {
  fetchSuperAdminTenantMap,
  TENANT_MAP_STATUS_LABELS,
  TENANT_MAP_STATUS_COLOR,
  type TenantMapResult,
  type MappedTenant,
} from "@/lib/superAdminTenantMap";
import { CustomerMapView, type CustomerMapViewHandle } from "@/components/superadmin/CustomerMapView";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/super-admin/customer-map")({
  ssr: false,
  component: CustomerMapPage,
});

type MapMode = "clients" | "tenants";

const MODE_OPTIONS: { value: MapMode; label: string }[] = [
  { value: "clients", label: "Clients" },
  { value: "tenants", label: "Tenants" },
];

const STATUS_FILTERS: { value: CustomerMapStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "active", label: "Client actif" },
  { value: "to_reactivate", label: "Client à relancer" },
  { value: "inactive", label: "Client inactif" },
];

const PERIOD_FILTERS: { value: number | "all"; label: string }[] = [
  { value: "all", label: "Toute période" },
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
];

const EMPTY_CUSTOMER_RESULT: CustomerMapResult = {
  customers: [],
  kpis: { geolocated: 0, zones_covered: 0, total_orders: 0, total_revenue: 0 },
  zones: [],
};

const EMPTY_TENANT_RESULT: TenantMapResult = {
  tenants: [],
  kpis: { located: 0, zones_covered: 0, total_orders: 0, total_revenue: 0 },
  zones: [],
};

function KpiCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />;
}

function CustomerDetailDialog({ customer, onOpenChange }: { customer: MappedCustomer | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={customer !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {customer && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StatusDot color={CUSTOMER_MAP_STATUS_COLOR[customer.status]} /> {customer.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Restaurant</span>
                <span className="font-medium">{customer.restaurant_name}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Téléphone</span>
                  <span className="font-medium">{customer.phone}</span>
                </div>
              )}
              {customer.zone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Localisation</span>
                  <span className="font-medium">{customer.zone}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <span className="font-medium">{CUSTOMER_MAP_STATUS_LABELS[customer.status]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nombre de commandes</span>
                <span className="font-medium">{customer.orders_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total dépensé</span>
                <span className="font-medium">{formatMoney(customer.total_spent, customer.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dernière commande</span>
                <span className="font-medium">
                  {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString("fr-FR") : "--"}
                </span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TenantDetailDialog({ tenant, onOpenChange }: { tenant: MappedTenant | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={tenant !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {tenant && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StatusDot color={TENANT_MAP_STATUS_COLOR[tenant.status]} /> {tenant.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {tenant.zone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Localisation</span>
                  <span className="font-medium">{tenant.zone}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <span className="font-medium">{TENANT_MAP_STATUS_LABELS[tenant.status]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nombre de clients</span>
                <span className="font-medium">{tenant.customers_count.toLocaleString("fr-FR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nombre de commandes</span>
                <span className="font-medium">{tenant.orders_count.toLocaleString("fr-FR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">CA</span>
                <span className="font-medium">{formatMoney(tenant.total_revenue, tenant.currency)}</span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CustomerMapPage() {
  const [mode, setMode] = useState<MapMode>("clients");

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [restaurantId, setRestaurantId] = useState<string>("all");
  const [status, setStatus] = useState<CustomerMapStatus | "all">("all");
  const [periodDays, setPeriodDays] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [result, setResult] = useState<CustomerMapResult>(EMPTY_CUSTOMER_RESULT);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<MappedCustomer | null>(null);

  // Fetched once on first switch to "tenants" and kept for the rest of the
  // session -- toggling back and forth between modes never re-fetches.
  const [tenantResult, setTenantResult] = useState<TenantMapResult | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<MappedTenant | null>(null);

  const mapRef = useRef<CustomerMapViewHandle>(null);

  useEffect(() => {
    fetchTenants()
      .then(setTenants)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Impossible de charger les tenants."));
  }, []);

  // Debounced so every keystroke doesn't trigger a round trip.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSuperAdminCustomerMap({
      restaurantId: restaurantId === "all" ? null : restaurantId,
      status: status === "all" ? null : status,
      periodDays: periodDays === "all" ? null : periodDays,
      search: debouncedSearch || null,
    })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger la carte des clients.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, status, periodDays, debouncedSearch]);

  useEffect(() => {
    if (mode !== "tenants" || tenantResult !== null) return;
    let cancelled = false;
    setTenantLoading(true);
    fetchSuperAdminTenantMap()
      .then((data) => {
        if (!cancelled) setTenantResult(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Impossible de charger la carte des tenants.");
      })
      .finally(() => {
        if (!cancelled) setTenantLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, tenantResult]);

  const activeTenants = useMemo(() => tenants.filter((t) => t.status !== "archived"), [tenants]);
  const tenantMap = tenantResult ?? EMPTY_TENANT_RESULT;

  const hasResults = mode === "clients" ? result.customers.length > 0 : tenantMap.tenants.length > 0;
  const isLoading = mode === "clients" ? loading : tenantLoading;
  // Every geolocated customer currently shown shares the same currency in
  // practice (single-country deployment) -- falls back to XOF, this app's
  // only currency today, only when the map has no customer to read it from.
  const revenueCurrency = result.customers[0]?.currency ?? tenantMap.tenants[0]?.currency ?? "XOF";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Carte géographique</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === "clients"
            ? "Répartition géographique des clients géolocalisés, tous tenants confondus."
            : "Répartition géographique des tenants géolocalisés sur la plateforme."}
        </p>
      </div>

      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              mode === option.value ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "clients" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard icon={MapPin} label="Clients localisés" value={result.kpis.geolocated.toLocaleString("fr-FR")} />
          <KpiCard icon={Compass} label="Zones couvertes" value={result.kpis.zones_covered.toLocaleString("fr-FR")} />
          <KpiCard icon={ShoppingBag} label="Commandes" value={result.kpis.total_orders.toLocaleString("fr-FR")} />
          <KpiCard icon={Wallet} label="CA clients" value={formatMoney(result.kpis.total_revenue, revenueCurrency)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard icon={Building2} label="Tenants localisés" value={tenantMap.kpis.located.toLocaleString("fr-FR")} />
          <KpiCard icon={Compass} label="Zones couvertes" value={tenantMap.kpis.zones_covered.toLocaleString("fr-FR")} />
          <KpiCard icon={ShoppingBag} label="Commandes" value={tenantMap.kpis.total_orders.toLocaleString("fr-FR")} />
          <KpiCard icon={Wallet} label="CA" value={formatMoney(tenantMap.kpis.total_revenue, revenueCurrency)} />
        </div>
      )}

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          {mode === "clients" && (
            <>
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

              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un client (nom, téléphone)"
                  className="h-11 rounded-xl border-slate-200 pl-9 text-sm shadow-sm"
                />
              </div>
            </>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => mapRef.current?.recenterCotedIvoire()}>
              Côte d'Ivoire
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => mapRef.current?.recenterAbidjan()}>
              Abidjan
            </Button>
          </div>
        </div>

        {mode === "clients" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatus(f.value)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    status === f.value ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
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
          </>
        )}
      </div>

      {/* Le fond de carte reste toujours monté, y compris à 0 résultat --
          seul un bandeau superposé change, jamais la carte elle-même. */}
      <div className="relative h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:h-[560px]">
        {isLoading && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-md">
            Chargement...
          </div>
        )}
        {!isLoading && !hasResults && (
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow-md">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {mode === "clients" ? "Aucun client géolocalisé pour ces filtres" : "Aucun tenant géolocalisé pour le moment"}
          </div>
        )}
        {mode === "clients" ? (
          <CustomerMapView ref={mapRef} mode="clients" customers={result.customers} onSelectCustomer={setSelectedCustomer} />
        ) : (
          <CustomerMapView ref={mapRef} mode="tenants" tenants={tenantMap.tenants} onSelectTenant={setSelectedTenant} />
        )}
      </div>

      {mode === "clients" ? (
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <StatusDot color={CUSTOMER_MAP_STATUS_COLOR.active} /> Actif
          </span>
          <span className="flex items-center gap-1.5">
            <StatusDot color={CUSTOMER_MAP_STATUS_COLOR.to_reactivate} /> À relancer
          </span>
          <span className="flex items-center gap-1.5">
            <StatusDot color={CUSTOMER_MAP_STATUS_COLOR.inactive} /> Inactif
          </span>
          <span>Cliquez sur un marqueur pour ouvrir la fiche client -- cliquez sur un regroupement pour zoomer.</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {(Object.keys(TENANT_MAP_STATUS_LABELS) as Array<keyof typeof TENANT_MAP_STATUS_LABELS>).map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <StatusDot color={TENANT_MAP_STATUS_COLOR[key]} /> {TENANT_MAP_STATUS_LABELS[key]}
            </span>
          ))}
          <span>Cliquez sur un marqueur pour ouvrir la fiche tenant -- cliquez sur un regroupement pour zoomer.</span>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-slate-900">Zones les plus actives</h2>
        <p className="mt-1 text-sm text-slate-600">
          {mode === "clients"
            ? "Quartiers/communes réellement déterminés à partir des adresses de livraison -- classés par nombre de clients."
            : "Communes/villes réellement déterminées à partir des tenants géolocalisés -- classées par nombre de tenants."}
        </p>
        {mode === "clients" ? (
          result.zones.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aucune zone déterminable pour ces filtres.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 text-left">Zone</th>
                    <th className="py-2 pr-4 text-right">Clients</th>
                    <th className="py-2 pr-4 text-right">Commandes</th>
                    <th className="py-2 text-right">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {result.zones.map((z) => (
                    <tr key={z.zone} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-900">{z.zone}</td>
                      <td className="py-2 pr-4 text-right">{z.customers_count.toLocaleString("fr-FR")}</td>
                      <td className="py-2 pr-4 text-right">{z.orders_count.toLocaleString("fr-FR")}</td>
                      <td className="py-2 text-right">{formatMoney(z.total_revenue, revenueCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tenantMap.zones.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucune zone déterminable pour le moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-4 text-left">Zone</th>
                  <th className="py-2 pr-4 text-right">Tenants</th>
                  <th className="py-2 pr-4 text-right">Commandes</th>
                  <th className="py-2 text-right">CA</th>
                </tr>
              </thead>
              <tbody>
                {tenantMap.zones.map((z) => (
                  <tr key={z.zone} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-900">{z.zone}</td>
                    <td className="py-2 pr-4 text-right">{z.tenants_count.toLocaleString("fr-FR")}</td>
                    <td className="py-2 pr-4 text-right">{z.orders_count.toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-right">{formatMoney(z.total_revenue, revenueCurrency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerDetailDialog customer={selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)} />
      <TenantDetailDialog tenant={selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)} />
    </div>
  );
}
