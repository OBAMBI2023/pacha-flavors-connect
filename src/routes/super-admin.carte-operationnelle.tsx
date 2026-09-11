import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Locate } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchTenants, type TenantRow } from "@/lib/superAdminTenants";
import { useSuperAdminDriverLocations } from "@/hooks/useSuperAdminDriverLocations";
import { driverStatusBucket, DRIVER_STATUS_BUCKET_LABELS } from "@/lib/drivers";
import type { DriverFleetMapHandle, FleetMapDriver } from "@/components/admin/drivers/DriverFleetMap";

// Same code-split rationale as DriversMapPanel/DriverTrackingModal: maplibre-gl
// is a large dependency, only fetched once this page is actually opened.
const DriverFleetMap = lazy(() => import("@/components/admin/drivers/DriverFleetMap").then((m) => ({ default: m.DriverFleetMap })));

export const Route = createFileRoute("/super-admin/carte-operationnelle")({
  ssr: false,
  component: CarteOperationnellePage,
});

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Cross-tenant GPS supervision -- reuses DriverFleetMap exactly as shipped
 * (unmodified: same MapLibre engine, same marker/popup rendering, same
 * recenter handles) fed by get_super_admin_driver_locations() instead of the
 * tenant-scoped useDriverFleetLocations. DriverFleetMap's popup has no
 * separate "Tenant" field, so the tenant name is folded into the driver's
 * display name (e.g. "Awa Koné · LE PACHA RESTAURANT") rather than touching
 * that component.
 */
function CarteOperationnellePage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [restaurantId, setRestaurantId] = useState<string>("all");
  const mapHandleRef = useRef<DriverFleetMapHandle>(null);

  useEffect(() => {
    fetchTenants()
      .then(setTenants)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Impossible de charger les tenants."));
  }, []);

  const activeTenants = useMemo(() => tenants.filter((t) => t.status !== "archived"), [tenants]);
  const { drivers, loading } = useSuperAdminDriverLocations(restaurantId === "all" ? null : restaurantId);

  const withPosition = drivers.filter((d) => d.last_lat != null && d.last_lng != null && isValidCoordinate(d.last_lat, d.last_lng));
  const withoutPosition = drivers.filter((d) => !(d.last_lat != null && d.last_lng != null && isValidCoordinate(d.last_lat, d.last_lng)));

  const fleetMarkers: FleetMapDriver[] = withPosition.map((d) => ({
    id: d.id,
    fullName: `${d.full_name} · ${d.restaurant_name}`,
    status: d.status,
    lat: d.last_lat as number,
    lng: d.last_lng as number,
    lastLocationAt: d.last_location_at,
    activeOrderNumber: d.active_order_number,
  }));

  const onlineCount = drivers.filter((d) => d.status !== "offline" && d.status !== "suspended").length;
  const onDeliveryCount = drivers.filter((d) => driverStatusBucket(d.status) === "on_delivery").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Carte opérationnelle</h1>
        <p className="mt-1 text-sm text-slate-600">Position GPS en temps quasi réel des livreurs, tous tenants confondus.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Livreurs en ligne</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{onlineCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En livraison</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{onDeliveryCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Positions GPS actives</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{fleetMarkers.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Livreurs suivis</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{drivers.length}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant</span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="h-11 w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
            >
              <option value="all">Tous les tenants</option>
              {activeTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => mapHandleRef.current?.recenterCotedIvoire()}>
              Côte d&apos;Ivoire
            </Button>
            <Button variant="outline" size="sm" onClick={() => mapHandleRef.current?.recenterAbidjan()}>
              Abidjan
            </Button>
            <Button variant="outline" size="sm" onClick={() => mapHandleRef.current?.fitAllDrivers()}>
              <Locate className="mr-1.5 h-4 w-4" /> Tous les livreurs
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>🟢 Disponible</span>
          <span>🟠 En livraison</span>
          <span>⚪ Hors ligne / position indisponible</span>
          {loading && <span>Actualisation...</span>}
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 sm:h-[560px]">
            Chargement de la carte...
          </div>
        }
      >
        <div className="h-[420px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:h-[560px]">
          <DriverFleetMap ref={mapHandleRef} drivers={fleetMarkers} />
        </div>
      </Suspense>

      {!loading && drivers.length === 0 && (
        <p className="text-center text-sm text-slate-500">Aucun livreur pour ce filtre -- la carte reste disponible.</p>
      )}

      {withoutPosition.length > 0 && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 text-sm shadow-sm">
          <p className="mb-2 font-medium text-slate-700">⚪ Sans position GPS</p>
          <ul className="space-y-1 text-slate-500">
            {withoutPosition.map((d) => (
              <li key={d.id}>
                {d.full_name} · {d.restaurant_name} · {DRIVER_STATUS_BUCKET_LABELS[driverStatusBucket(d.status)]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
