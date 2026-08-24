import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCustomer, type Customer } from "@/lib/customers-db";

export function EditCustomerDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setFullName(customer.full_name);
      setEmail(customer.email ?? "");
      setAddress(customer.address ?? "");
      setInternalNote(customer.internal_note ?? "");
    }
  }, [customer]);

  async function save() {
    if (!customer || !fullName.trim()) return;
    setSaving(true);
    try {
      await updateCustomer(customer.id, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        internal_note: internalNote.trim() || null,
      });
      toast.success("Client mis à jour");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour ce client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(customer)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
          <DialogDescription>Le numéro de téléphone identifie ce client et n'est pas modifiable ici.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Nom</span>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Adresse</span>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Note interne</span>
            <Input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Visible uniquement par votre équipe" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={() => void save()} disabled={saving || !fullName.trim()}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
