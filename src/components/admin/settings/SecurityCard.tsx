import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function validateNewPassword(password: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}

export function SecurityCard({ email }: { email: string | null }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    if (!email) {
      toast.error("Impossible de déterminer votre e-mail.");
      return;
    }
    if (!currentPassword) {
      toast.error("Renseignez votre mot de passe actuel.");
      return;
    }
    const validationError = validateNewPassword(newPassword);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }

    setBusy(true);
    try {
      // Re-validate the current password via a normal sign-in -- the
      // standard, safe way to confirm it without ever storing it anywhere.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) {
        toast.error("Mot de passe actuel incorrect.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        toast.error(updateError.message);
        return;
      }
      toast.success("Mot de passe modifié avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold">Sécurité</h3>
      <p className="mt-1 text-sm text-muted-foreground">Modifier mon mot de passe</p>
      <div className="mt-4 grid gap-4 sm:max-w-md">
        <div className="space-y-2">
          <Label htmlFor="current-password">Mot de passe actuel</Label>
          <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Nouveau mot de passe</Label>
          <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
          <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} />
        </div>
        <Button onClick={() => void changePassword()} disabled={busy} className="w-full sm:w-auto">
          {busy ? "Modification..." : "Modifier mon mot de passe"}
        </Button>
      </div>
    </div>
  );
}
