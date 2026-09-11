import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase-any";
import { signupOrganization, slugifyOrganizationName } from "@/lib/organizationDelivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TITLE = "Créer un compte | SAOVIA Delivery";

export const Route = createFileRoute("/delivery/signup")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DeliverySignupPage,
});

function DeliverySignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!orgName.trim()) {
      setError("Le nom de l'organisation est requis.");
      return;
    }
    setBusy(true);
    try {
      // org_name travels in the signUp metadata so it survives until the
      // user actually has a session -- this project requires email
      // confirmation, so signUp never returns one here.
      const signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone, org_name: orgName.trim() } },
      });
      if (signUpResult.error) throw signUpResult.error;
      if (!signUpResult.data.session) {
        // Never call signInWithPassword here -- it would fail with "Email
        // not confirmed" and make a successful signup look broken.
        // Organization creation is deferred to first login (delivery.login.tsx),
        // which reads org_name back out of user_metadata once a real
        // session exists.
        setConfirmationPending(true);
        return;
      }
      await signupOrganization(orgName.trim(), slugifyOrganizationName(orgName));
      navigate({ to: "/delivery/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le compte.");
    } finally {
      setBusy(false);
    }
  }

  if (confirmationPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">SAOVIA Delivery</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Vérifiez votre boîte mail</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Un email de confirmation a été envoyé à <span className="font-medium text-foreground">{email}</span>. Cliquez sur le lien qu'il contient, puis connectez-vous pour terminer la création de votre organisation.
          </p>
          <Button asChild className="mt-6 h-12 w-full">
            <Link to="/delivery/login">Aller à la connexion</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">SAOVIA Delivery</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Créer votre compte</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Nom</Label>
            <Input id="full-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-name">Nom de l'organisation</Label>
            <Input id="org-name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmation du mot de passe</Label>
            <Input id="confirm-password" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full" disabled={busy}>
            {busy ? "Création..." : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/delivery/login" className="underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
