import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCustomer, isDuplicateCustomerPhoneError } from "@/lib/customers-db";

function emptyForm() {
  return { fullName: "", phone: "", email: "", address: "", internalNote: "" };
}

/** Admin > Clients > "Ajouter un client" -- creates a customer with source='restaurant', tenant-scoped to restaurantId. No site account/signup email is involved. */
export function AddClientDialog({
  restaurantId,
  open,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      onClose();
      setForm(emptyForm());
    }
  }

  async function save() {
    if (!form.fullName.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      await createCustomer(restaurantId, {
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        internal_note: form.internalNote.trim() || null,
      });
      toast.success("Client ajouté");
      setForm(emptyForm());
      onSaved();
    } catch (err) {
      if (isDuplicateCustomerPhoneError(err)) toast.error("Un client avec ce numéro existe déjà.");
      else toast.error(err instanceof Error ? err.message : "Impossible d'ajouter ce client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un client</DialogTitle>
          <DialogDescription>Ce client est ajouté à votre liste sans créer de compte sur le site.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Nom complet *</span>
            <Input value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Téléphone *</span>
            <Input type="tel" value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} placeholder="07 XX XX XX XX" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Email</span>
            <Input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Adresse</span>
            <Input value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Note interne</span>
            <Input value={form.internalNote} onChange={(e) => setForm((c) => ({ ...c, internalNote: e.target.value }))} placeholder="Visible uniquement par votre équipe" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={() => void save()} disabled={saving || !form.fullName.trim() || !form.phone.trim()}>
            {saving ? "Ajout..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
