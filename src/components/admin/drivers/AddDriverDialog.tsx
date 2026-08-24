import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDriver, uploadDriverFile, type CreateDriverResult } from "@/lib/drivers";
import { supabase } from "@/integrations/supabase/client";

function emptyForm() {
  return { lastName: "", firstName: "", phone: "", phoneSecondary: "", email: "", address: "", dateOfBirth: "", hiredAt: "", internalNote: "" };
}

/**
 * "Ajouter un livreur" -- creates a real login-capable account via the
 * admin-create-driver Edge Function (service-role auth.admin.createUser +
 * driver_profiles insert), then optionally uploads a profile photo. Vehicle
 * and documents are added afterwards from the driver's own profile sheet,
 * not crammed into this same submission (keeps the Edge Function itself
 * small and un-bloated by file bytes).
 */
export function AddDriverDialog({
  restaurantId,
  open,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateDriverResult | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setForm(emptyForm());
    setPhotoFile(null);
    setResult(null);
    setCopied(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      onClose();
      if (result) onCreated();
      reset();
    }
  }

  async function save() {
    const fullName = `${form.lastName.trim()} ${form.firstName.trim()}`.trim();
    if (!form.lastName.trim() || !form.firstName.trim() || !form.phone.trim()) {
      toast.error("Nom, prénom et téléphone sont requis.");
      return;
    }
    setSaving(true);
    try {
      const created = await createDriver({
        restaurant_id: restaurantId,
        full_name: fullName,
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        phone_secondary: form.phoneSecondary.trim() || null,
        address: form.address.trim() || null,
        date_of_birth: form.dateOfBirth || null,
        hired_at: form.hiredAt || null,
        internal_note: form.internalNote.trim() || null,
      });
      if (photoFile) {
        const path = await uploadDriverFile(restaurantId, created.driver_id, "profile", photoFile);
        await supabase.from("driver_profiles").update({ photo_path: path }).eq("id", created.driver_id);
      }
      setResult(created);
      toast.success("Livreur créé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer ce livreur.");
    } finally {
      setSaving(false);
    }
  }

  function copyPassword() {
    if (!result) return;
    void navigator.clipboard.writeText(result.temp_password).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Livreur créé</DialogTitle>
              <DialogDescription>Communiquez ces identifiants au livreur. Le mot de passe ne sera plus jamais affiché.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Identifiant de connexion (email)</p>
                <p className="mt-1 font-mono text-sm">{result.email_used}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mot de passe temporaire</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="font-mono text-lg font-semibold">{result.temp_password}</p>
                  <Button variant="outline" size="sm" onClick={copyPassword}>
                    {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copied ? "Copié" : "Copier"}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Terminé</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Ajouter un livreur</DialogTitle>
              <DialogDescription>Un compte de connexion est créé automatiquement. Véhicule et documents s'ajoutent ensuite depuis sa fiche.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom *</Label>
                  <Input value={form.lastName} onChange={(e) => setForm((c) => ({ ...c, lastName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Prénom *</Label>
                  <Input value={form.firstName} onChange={(e) => setForm((c) => ({ ...c, firstName: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Téléphone principal *</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone secondaire</Label>
                  <Input type="tel" value={form.phoneSecondary} onChange={(e) => setForm((c) => ({ ...c, phoneSecondary: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="Optionnel -- sinon un identifiant est généré" />
              </div>
              <div className="space-y-1.5">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Date de naissance</Label>
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((c) => ({ ...c, dateOfBirth: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date d'intégration</Label>
                  <Input type="date" value={form.hiredAt} onChange={(e) => setForm((c) => ({ ...c, hiredAt: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Photo de profil</Label>
                <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Note interne</Label>
                <Input value={form.internalNote} onChange={(e) => setForm((c) => ({ ...c, internalNote: e.target.value }))} placeholder="Visible uniquement par votre équipe" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>Annuler</Button>
              <Button onClick={() => void save()} disabled={saving}>{saving ? "Création..." : "Créer le livreur"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
