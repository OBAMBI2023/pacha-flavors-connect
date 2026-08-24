import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_STATUS_CLASSNAMES,
  DOCUMENT_STATUS_LABELS,
  documentStatus,
  fetchAllDriverDocuments,
  fetchDrivers,
  fetchVehicles,
  IDENTITY_DOCUMENT_TYPE_LABELS,
  type Driver,
  type DriverDocument,
  type VehicleWithDriver,
} from "@/lib/drivers";
import { DriverProfileSheet } from "./DriverProfileSheet";

type Row = {
  driver: Driver;
  identity: DriverDocument | null;
  license: DriverDocument | null;
  vehicle: VehicleWithDriver | null;
};

export function DocumentsPanel({ restaurantId }: { restaurantId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [{ drivers }, documents, vehicles] = await Promise.all([
        fetchDrivers(restaurantId, { page: 0 }),
        fetchAllDriverDocuments(restaurantId),
        fetchVehicles(restaurantId),
      ]);
      setRows(
        drivers.map((driver) => ({
          driver,
          identity: documents.find((d) => d.driver_id === driver.id && d.kind === "identity") ?? null,
          license: documents.find((d) => d.driver_id === driver.id && d.kind === "license") ?? null,
          vehicle: vehicles.find((v) => v.driver_id === driver.id && v.is_active) ?? null,
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pièces d'identité, permis, assurance et visite technique -- toutes flottes confondues.</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <FileWarning className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun livreur pour le moment.</p>
        </div>
      ) : (
        <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Livreur</th>
                <th className="px-4 py-3 text-left">Pièce d'identité</th>
                <th className="px-4 py-3 text-left">Permis</th>
                <th className="px-4 py-3 text-left">Assurance</th>
                <th className="px-4 py-3 text-left">Visite technique</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ driver, identity, license, vehicle }) => {
                const identityLabel = identity?.document_type ? IDENTITY_DOCUMENT_TYPE_LABELS[identity.document_type] : null;
                return (
                  <tr key={driver.id} className="cursor-pointer border-t border-border hover:bg-accent/40" onClick={() => setDetailId(driver.id)}>
                    <td className="px-4 py-3 font-medium">{driver.full_name}</td>
                    <td className="px-4 py-3">
                      <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(identity?.expires_at)]}>{DOCUMENT_STATUS_LABELS[documentStatus(identity?.expires_at)]}</Badge>
                      {identityLabel && <span className="ml-2 text-xs text-muted-foreground">{identityLabel}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(license?.expires_at)]}>{DOCUMENT_STATUS_LABELS[documentStatus(license?.expires_at)]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(vehicle ? vehicle.insurance_expires_at : undefined)]}>
                        {DOCUMENT_STATUS_LABELS[documentStatus(vehicle ? vehicle.insurance_expires_at : undefined)]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(vehicle ? vehicle.inspection_expires_at : undefined)]}>
                        {DOCUMENT_STATUS_LABELS[documentStatus(vehicle ? vehicle.inspection_expires_at : undefined)]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile: compact cards. */}
      <div className="space-y-2.5 md:hidden">
        {rows.map(({ driver, identity, license, vehicle }) => (
          <button key={driver.id} onClick={() => setDetailId(driver.id)} className="block w-full rounded-2xl border border-border bg-card p-3.5 text-left">
            <p className="text-sm font-semibold">{driver.full_name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(identity?.expires_at)]}>Pièce : {DOCUMENT_STATUS_LABELS[documentStatus(identity?.expires_at)]}</Badge>
              <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(license?.expires_at)]}>Permis : {DOCUMENT_STATUS_LABELS[documentStatus(license?.expires_at)]}</Badge>
              <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(vehicle ? vehicle.insurance_expires_at : undefined)]}>Assurance : {DOCUMENT_STATUS_LABELS[documentStatus(vehicle ? vehicle.insurance_expires_at : undefined)]}</Badge>
              <Badge className={DOCUMENT_STATUS_CLASSNAMES[documentStatus(vehicle ? vehicle.inspection_expires_at : undefined)]}>Visite : {DOCUMENT_STATUS_LABELS[documentStatus(vehicle ? vehicle.inspection_expires_at : undefined)]}</Badge>
            </div>
          </button>
        ))}
      </div>

      <DriverProfileSheet restaurantId={restaurantId} driverId={detailId} onClose={() => setDetailId(null)} onChanged={refresh} />
    </div>
  );
}
