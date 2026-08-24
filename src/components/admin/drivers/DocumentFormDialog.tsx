import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  IDENTITY_DOCUMENT_TYPE_LABELS,
  uploadDriverFile,
  upsertDriverDocument,
  type DriverDocument,
  type DriverDocumentKind,
  type IdentityDocumentType,
} from "@/lib/drivers";

function emptyForm(driverId: string, kind: DriverDocumentKind) {
  return {
    driver_id: driverId,
    kind,
    document_type: "cni" as IdentityDocumentType,
    document_number: "",
    category: "",
    issued_at: "",
    expires_at: "",
  };
}

/** Shared by AddDriverDialog and DriverProfileSheet -- one form for both identity documents and driving licenses (kind switches which fields show). */
export function DocumentFormDialog({
  restaurantId,
  driverId,
  kind,
  existing,
  open,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  driverId: string;
  kind: DriverDocumentKind;
  existing: DriverDocument | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => emptyForm(driverId, kind));
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        driver_id: driverId,
        kind,
        document_type: existing.document_type ?? "cni",
        document_number: existing.document_number ?? "",
        category: existing.category ?? "",
        issued_at: existing.issued_at ?? "",
        expires_at: existing.expires_at ?? "",
      });
    } else {
      setForm(emptyForm(driverId, kind));
    }
    setFrontFile(null);
    setBackFile(null);
  }, [open, existing, driverId, kind]);

  async function save() {
    setSaving(true);
    try {
      const frontPath = frontFile ? await uploadDriverFile(restaurantId, driverId, "documents", frontFile) : existing?.front_path ?? null;
      const backPath = backFile ? await uploadDriverFile(restaurantId, driverId, "documents", backFile) : existing?.back_path ?? null;
      await upsertDriverDocument(restaurantId, {
        driver_id: driverId,
        kind,
        document_type: kind === "identity" ? form.document_type : null,
        document_number: form.document_number.trim() || null,
        category: kind === "license" ? form.category.trim() || null : null,
        issued_at: form.issued_at || null,
        expires_at: form.expires_at || null,
        front_path: frontPath,
        back_path: backPath,
      });
      toast.success(kind === "identity" ? "Pièce d'identité enregistrée" : "Permis enregistré");
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer ce document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind === "identity" ? "Pièce d'identité" : "Permis de conduire"}</DialogTitle>
          <DialogDescription>Document sensible -- visible uniquement par le propriétaire et les gérants de ce restaurant.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {kind === "identity" ? (
            <div className="space-y-1.5">
              <Label>Type de pièce</Label>
              <Select value={form.document_type} onValueChange={(v) => setForm((c) => ({ ...c, document_type: v as IdentityDocumentType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(IDENTITY_DOCUMENT_TYPE_LABELS) as IdentityDocumentType[]).map((t) => (
                    <SelectItem key={t} value={t}>{IDENTITY_DOCUMENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Input value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} placeholder="Ex. A, B..." />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Numéro</Label>
            <Input value={form.document_number} onChange={(e) => setForm((c) => ({ ...c, document_number: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date d'émission</Label>
              <Input type="date" value={form.issued_at} onChange={(e) => setForm((c) => ({ ...c, issued_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date d'expiration</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm((c) => ({ ...c, expires_at: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Photo/scan recto</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
              {existing?.front_path && !frontFile && <p className="text-xs text-muted-foreground">Un fichier existe déjà.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Photo/scan verso</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
              {existing?.back_path && !backFile && <p className="text-xs text-muted-foreground">Un fichier existe déjà.</p>}
            </div>
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
