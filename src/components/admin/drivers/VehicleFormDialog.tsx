import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createVehicle,
  isDuplicateActiveVehicleError,
  updateVehicle,
  uploadDriverFile,
  VEHICLE_TYPE_LABELS,
  type Vehicle,
  type VehicleInput,
  type VehicleType,
} from "@/lib/drivers";

function emptyForm(driverId: string): VehicleInput {
  return { driver_id: driverId, vehicle_type: "moto", make: "", model: "", year: null, color: "", plate_number: "", chassis_number: "", insurance_expires_at: "", inspection_expires_at: "" };
}

/** Shared by AddDriverDialog, DriverProfileSheet and VehiclesPanel -- one form, reused everywhere a vehicle is created or edited. */
export function VehicleFormDialog({
  restaurantId,
  driverId,
  vehicle,
  open,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  driverId: string;
  vehicle: Vehicle | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<VehicleInput>(() => emptyForm(driverId));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (vehicle) {
      setForm({
        driver_id: driverId,
        vehicle_type: vehicle.vehicle_type,
        make: vehicle.make ?? "",
        model: vehicle.model ?? "",
        year: vehicle.year,
        color: vehicle.color ?? "",
        plate_number: vehicle.plate_number,
        chassis_number: vehicle.chassis_number ?? "",
        insurance_expires_at: vehicle.insurance_expires_at ?? "",
        inspection_expires_at: vehicle.inspection_expires_at ?? "",
      });
    } else {
      setForm(emptyForm(driverId));
    }
    setPhotoFile(null);
  }, [open, vehicle, driverId]);

  async function save() {
    if (!form.vehicle_type || !form.plate_number.trim()) {
      toast.error("Le type et l'immatriculation sont requis.");
      return;
    }
    setSaving(true);
    try {
      const photoPath = photoFile ? await uploadDriverFile(restaurantId, driverId, "vehicle", photoFile) : undefined;
      const payload: VehicleInput = {
        ...form,
        plate_number: form.plate_number.trim(),
        make: form.make?.trim() || null,
        model: form.model?.trim() || null,
        color: form.color?.trim() || null,
        chassis_number: form.chassis_number?.trim() || null,
        insurance_expires_at: form.insurance_expires_at || null,
        inspection_expires_at: form.inspection_expires_at || null,
        ...(photoPath ? { photo_path: photoPath } : {}),
      };
      if (vehicle) await updateVehicle(vehicle.id, payload);
      else await createVehicle(restaurantId, payload);
      toast.success(vehicle ? "Véhicule mis à jour" : "Véhicule ajouté");
      onClose();
      onSaved();
    } catch (err) {
      if (isDuplicateActiveVehicleError(err)) toast.error("Ce livreur a déjà un véhicule actif. Désactivez-le d'abord.");
      else toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer le véhicule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Modifier le véhicule" : "Ajouter un véhicule"}</DialogTitle>
          <DialogDescription>Un livreur ne peut avoir qu'un seul véhicule actif à la fois.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type de véhicule</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm((c) => ({ ...c, vehicle_type: v as VehicleType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map((t) => (
                    <SelectItem key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Immatriculation</Label>
              <Input value={form.plate_number} onChange={(e) => setForm((c) => ({ ...c, plate_number: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Marque</Label>
              <Input value={form.make ?? ""} onChange={(e) => setForm((c) => ({ ...c, make: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Modèle</Label>
              <Input value={form.model ?? ""} onChange={(e) => setForm((c) => ({ ...c, model: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Année</Label>
              <Input type="number" value={form.year ?? ""} onChange={(e) => setForm((c) => ({ ...c, year: e.target.value === "" ? null : Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <Input value={form.color ?? ""} onChange={(e) => setForm((c) => ({ ...c, color: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Numéro de châssis</Label>
              <Input value={form.chassis_number ?? ""} onChange={(e) => setForm((c) => ({ ...c, chassis_number: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Expiration de l'assurance</Label>
              <Input type="date" value={form.insurance_expires_at ?? ""} onChange={(e) => setForm((c) => ({ ...c, insurance_expires_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiration de la visite technique</Label>
              <Input type="date" value={form.inspection_expires_at ?? ""} onChange={(e) => setForm((c) => ({ ...c, inspection_expires_at: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Photo du véhicule</Label>
            <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
