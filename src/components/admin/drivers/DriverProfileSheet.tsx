import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilLine, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DOCUMENT_STATUS_CLASSNAMES,
  DOCUMENT_STATUS_LABELS,
  DRIVER_ACCOUNT_STATUS_CLASSNAMES,
  DRIVER_STATUS_BUCKET_CLASSNAMES,
  DRIVER_STATUS_BUCKET_LABELS,
  IDENTITY_DOCUMENT_TYPE_LABELS,
  VEHICLE_TYPE_LABELS,
  documentStatus,
  driverAccountStatusLabel,
  driverStatusBucket,
  fetchDriver,
  fetchDriverAssignmentHistory,
  fetchDriverDocuments,
  fetchDriverFleetStats,
  fetchVehicles,
  getDriverFileUrl,
  resendDriverInvite,
  setDriverActive,
  suspendDriver,
  unsuspendDriver,
  updateDriver,
  uploadDriverFile,
  type Driver,
  type DriverAssignmentHistoryEntry,
  type DriverDocument,
  type DriverFleetStats,
  type Vehicle,
} from "@/lib/drivers";
import { VehicleFormDialog } from "./VehicleFormDialog";
import { DocumentFormDialog } from "./DocumentFormDialog";
import { supabase } from "@/integrations/supabase/client";

function money(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function DocBadge({ expiresAt }: { expiresAt: string | null | undefined }) {
  const status = documentStatus(expiresAt);
  return <Badge className={DOCUMENT_STATUS_CLASSNAMES[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>;
}

export function DriverProfileSheet({
  restaurantId,
  driverId,
  onClose,
  onChanged,
}: {
  restaurantId: string;
  driverId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const isMobile = useIsMobile();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [history, setHistory] = useState<DriverAssignmentHistoryEntry[]>([]);
  const [stats, setStats] = useState<DriverFleetStats | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", phone: "", phoneSecondary: "", email: "", address: "", internalNote: "" });
  const [busy, setBusy] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [documentDialogKind, setDocumentDialogKind] = useState<"identity" | "license" | null>(null);
  const [resending, setResending] = useState(false);

  async function refresh() {
    if (!driverId) return;
    setLoading(true);
    try {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const [driverRow, vehicles, docs, historyRes, statsRes] = await Promise.all([
        fetchDriver(driverId),
        fetchVehicles(restaurantId, { driverId }),
        fetchDriverDocuments(driverId),
        fetchDriverAssignmentHistory(restaurantId, { driverId }),
        fetchDriverFleetStats(monthAgo, now),
      ]);
      setDriver(driverRow);
      setVehicle(vehicles.find((v) => v.is_active) ?? null);
      setDocuments(docs);
      setHistory(historyRes.entries);
      setStats(statsRes);
      if (driverRow?.photo_path) setPhotoUrl(await getDriverFileUrl(driverRow.photo_path));
      else setPhotoUrl(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger ce livreur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!driverId) {
      setDriver(null);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  function startEdit() {
    if (!driver) return;
    setEditForm({
      fullName: driver.full_name,
      phone: driver.phone,
      phoneSecondary: driver.phone_secondary ?? "",
      email: driver.email ?? "",
      address: driver.address ?? "",
      internalNote: driver.internal_note ?? "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!driver) return;
    setBusy(true);
    try {
      await updateDriver(driver.id, {
        full_name: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        phone_secondary: editForm.phoneSecondary.trim() || null,
        email: editForm.email.trim() || null,
        address: editForm.address.trim() || null,
        internal_note: editForm.internalNote.trim() || null,
      });
      toast.success("Livreur mis à jour");
      setEditing(false);
      await refresh();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour ce livreur.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhotoChange(file: File) {
    if (!driver) return;
    setBusy(true);
    try {
      const path = await uploadDriverFile(restaurantId, driver.id, "profile", file);
      await supabase.from("driver_profiles").update({ photo_path: path }).eq("id", driver.id);
      toast.success("Photo mise à jour");
      await refresh();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour la photo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSuspendToggle() {
    if (!driver) return;
    setBusy(true);
    try {
      if (driver.status === "suspended") await unsuspendDriver(driver.id);
      else await suspendDriver(driver.id);
      toast.success(driver.status === "suspended" ? "Livreur réactivé" : "Livreur suspendu");
      await refresh();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendInvite() {
    if (!driver) return;
    setResending(true);
    try {
      await resendDriverInvite(driver.id);
      toast.success("Invitation envoyée par e-mail.");
      await refresh();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de renvoyer l'invitation.");
    } finally {
      setResending(false);
    }
  }

  async function handleActiveToggle() {
    if (!driver) return;
    setBusy(true);
    try {
      await setDriverActive(driver.id, !driver.is_active);
      toast.success(driver.is_active ? "Livreur désactivé" : "Livreur réactivé");
      await refresh();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  const identityDoc = documents.find((d) => d.kind === "identity") ?? null;
  const licenseDoc = documents.find((d) => d.kind === "license") ?? null;
  const bucket = driver ? driverStatusBucket(driver.status) : null;
  const driverStats = stats?.by_driver.find((d) => d.driver_id === driverId);

  return (
    <>
      <Sheet open={Boolean(driverId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[92vh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-2xl"}>
          {loading && !driver && <p className="pt-6 text-sm text-muted-foreground">Chargement...</p>}
          {driver && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {photoUrl ? (
                      <img src={photoUrl} alt={driver.full_name} className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                        {driver.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="flex flex-wrap items-center gap-2">
                      {driver.full_name}
                      {bucket && <Badge className={DRIVER_STATUS_BUCKET_CLASSNAMES[bucket]}>{DRIVER_STATUS_BUCKET_LABELS[bucket]}</Badge>}
                      <Badge className={DRIVER_ACCOUNT_STATUS_CLASSNAMES[driver.account_status]}>{driverAccountStatusLabel(driver)}</Badge>
                      {!driver.is_active && <Badge className="bg-muted text-muted-foreground">Désactivé</Badge>}
                    </SheetTitle>
                    <SheetDescription>{driver.phone}{vehicle ? ` · ${VEHICLE_TYPE_LABELS[vehicle.vehicle_type]} · ${vehicle.plate_number}` : ""}</SheetDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={startEdit}><PencilLine className="mr-1.5 h-3.5 w-3.5" />Modifier</Button>
                  <Button variant="outline" size="sm" onClick={() => void handleSuspendToggle()} disabled={busy}>
                    {driver.status === "suspended" ? "Lever la suspension" : "Suspendre"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleActiveToggle()} disabled={busy}>
                    {driver.is_active ? "Désactiver" : "Réactiver"}
                  </Button>
                  {driver.email && (
                    <Button variant="outline" size="sm" onClick={() => void handleResendInvite()} disabled={resending}>
                      {resending ? "Envoi..." : "Renvoyer l'invitation"}
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="mt-5 space-y-6 text-sm">
                {editing ? (
                  <section className="space-y-3 rounded-2xl border border-border p-4">
                    <h3 className="font-semibold">Modifier</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 block"><span className="text-xs font-medium text-muted-foreground">Nom complet</span><Input value={editForm.fullName} onChange={(e) => setEditForm((c) => ({ ...c, fullName: e.target.value }))} /></label>
                      <label className="space-y-1.5 block"><span className="text-xs font-medium text-muted-foreground">Téléphone principal</span><Input value={editForm.phone} onChange={(e) => setEditForm((c) => ({ ...c, phone: e.target.value }))} /></label>
                      <label className="space-y-1.5 block"><span className="text-xs font-medium text-muted-foreground">Téléphone secondaire</span><Input value={editForm.phoneSecondary} onChange={(e) => setEditForm((c) => ({ ...c, phoneSecondary: e.target.value }))} /></label>
                      <label className="space-y-1.5 block"><span className="text-xs font-medium text-muted-foreground">Email</span><Input value={editForm.email} onChange={(e) => setEditForm((c) => ({ ...c, email: e.target.value }))} /></label>
                    </div>
                    <label className="space-y-1.5 block"><span className="text-xs font-medium text-muted-foreground">Adresse</span><Input value={editForm.address} onChange={(e) => setEditForm((c) => ({ ...c, address: e.target.value }))} /></label>
                    <label className="space-y-1.5 block"><span className="text-xs font-medium text-muted-foreground">Note interne</span><Input value={editForm.internalNote} onChange={(e) => setEditForm((c) => ({ ...c, internalNote: e.target.value }))} /></label>
                    <label className="space-y-1.5 block"><span className="text-xs font-medium text-muted-foreground">Changer la photo</span><Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePhotoChange(f); }} /></label>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void saveEdit()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>Annuler</Button>
                    </div>
                  </section>
                ) : (
                  <section className="space-y-1.5 rounded-2xl border border-border p-4">
                    <h3 className="font-semibold">Coordonnées</h3>
                    <p className="text-muted-foreground">{driver.phone}{driver.phone_secondary ? ` · ${driver.phone_secondary}` : ""}</p>
                    <p className="text-muted-foreground">{driver.email ?? "Email non renseigné"}</p>
                    <p className="text-muted-foreground">{driver.address ?? "Adresse non renseignée"}</p>
                    {driver.date_of_birth && <p className="text-muted-foreground">Né(e) le {new Date(driver.date_of_birth).toLocaleDateString("fr-FR")}</p>}
                    {driver.hired_at && <p className="text-muted-foreground">Intégré le {new Date(driver.hired_at).toLocaleDateString("fr-FR")}</p>}
                    {driver.internal_note && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-muted/60 p-2.5 text-foreground">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {driver.internal_note}
                      </p>
                    )}
                  </section>
                )}

                <section className="space-y-2 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Pièce d'identité</h3>
                    <div className="flex items-center gap-2">
                      <DocBadge expiresAt={identityDoc?.expires_at} />
                      <Button variant="ghost" size="sm" onClick={() => setDocumentDialogKind("identity")}>{identityDoc ? "Modifier" : "Ajouter"}</Button>
                    </div>
                  </div>
                  {identityDoc && (
                    <p className="text-muted-foreground">
                      {identityDoc.document_type ? IDENTITY_DOCUMENT_TYPE_LABELS[identityDoc.document_type] : ""} {identityDoc.document_number ?? ""}
                      {identityDoc.expires_at && ` · Expire le ${new Date(identityDoc.expires_at).toLocaleDateString("fr-FR")}`}
                    </p>
                  )}
                </section>

                <section className="space-y-2 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Permis de conduire</h3>
                    <div className="flex items-center gap-2">
                      <DocBadge expiresAt={licenseDoc?.expires_at} />
                      <Button variant="ghost" size="sm" onClick={() => setDocumentDialogKind("license")}>{licenseDoc ? "Modifier" : "Ajouter"}</Button>
                    </div>
                  </div>
                  {licenseDoc && (
                    <p className="text-muted-foreground">
                      {licenseDoc.category ? `Catégorie ${licenseDoc.category} · ` : ""}{licenseDoc.document_number ?? ""}
                      {licenseDoc.expires_at && ` · Expire le ${new Date(licenseDoc.expires_at).toLocaleDateString("fr-FR")}`}
                    </p>
                  )}
                </section>

                <section className="space-y-2 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Véhicule</h3>
                    <div className="flex items-center gap-2">
                      {vehicle && <DocBadge expiresAt={vehicle.insurance_expires_at && vehicle.inspection_expires_at ? [vehicle.insurance_expires_at, vehicle.inspection_expires_at].sort()[0] : vehicle.insurance_expires_at ?? vehicle.inspection_expires_at} />}
                      <Button variant="ghost" size="sm" onClick={() => setVehicleDialogOpen(true)}>{vehicle ? "Modifier" : "Ajouter"}</Button>
                    </div>
                  </div>
                  {vehicle ? (
                    <p className="text-muted-foreground">
                      {VEHICLE_TYPE_LABELS[vehicle.vehicle_type]} · {[vehicle.make, vehicle.model].filter(Boolean).join(" ")} · {vehicle.plate_number}
                      {vehicle.insurance_expires_at && ` · Assurance : ${new Date(vehicle.insurance_expires_at).toLocaleDateString("fr-FR")}`}
                      {vehicle.inspection_expires_at && ` · Visite technique : ${new Date(vehicle.inspection_expires_at).toLocaleDateString("fr-FR")}`}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Aucun véhicule actif.</p>
                  )}
                </section>

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-border p-3"><p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Livraisons (30j)</p><p className="mt-1 font-display text-xl font-semibold">{driverStats?.total_deliveries ?? 0}</p></div>
                  <div className="rounded-2xl border border-border p-3"><p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Terminées</p><p className="mt-1 font-display text-xl font-semibold">{driverStats?.completed ?? 0}</p></div>
                  <div className="rounded-2xl border border-border p-3"><p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Taux de réussite</p><p className="mt-1 font-display text-xl font-semibold">{driverStats?.success_rate != null ? `${driverStats.success_rate}%` : "—"}</p></div>
                  <div className="rounded-2xl border border-border p-3"><p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Temps moyen</p><p className="mt-1 font-display text-xl font-semibold">{driverStats?.avg_delivery_minutes != null ? `${driverStats.avg_delivery_minutes} min` : "—"}</p></div>
                </section>

                <section className="space-y-2">
                  <h3 className="font-semibold">Historique des livraisons</h3>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune livraison pour le moment.</p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((h) => (
                        <li key={h.id} className="rounded-2xl border border-border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">#{h.order_number ?? "—"}</span>
                            <Badge variant="outline">{h.assignment_type === "manual" ? "Manuelle" : "Automatique"}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")} · {h.customer_name ?? ""}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {driver && (
        <>
          <VehicleFormDialog
            restaurantId={restaurantId}
            driverId={driver.id}
            vehicle={vehicle}
            open={vehicleDialogOpen}
            onClose={() => setVehicleDialogOpen(false)}
            onSaved={() => { void refresh(); onChanged(); }}
          />
          {documentDialogKind && (
            <DocumentFormDialog
              restaurantId={restaurantId}
              driverId={driver.id}
              kind={documentDialogKind}
              existing={documentDialogKind === "identity" ? identityDoc : licenseDoc}
              open={Boolean(documentDialogKind)}
              onClose={() => setDocumentDialogKind(null)}
              onSaved={() => { void refresh(); onChanged(); }}
            />
          )}
        </>
      )}
    </>
  );
}
