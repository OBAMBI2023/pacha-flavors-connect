import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TITLE = "Connexion | SAOVIA Delivery";

export const Route = createFileRoute("/delivery/login")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DeliveryLoginPage,
});

function DeliveryLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    navigate({ to: "/delivery/dashboard" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">SAOVIA Delivery</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Se connecter</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full" disabled={busy}>
            {busy ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/delivery/signup" className="underline underline-offset-4">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
