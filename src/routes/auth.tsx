import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TITLE = "Espace administrateur | Le Pacha Restaurant";
const DESCRIPTION =
  "Connexion a l'espace d'administration du Pacha Restaurant pour gerer la carte, les prix et les photos des plats.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (result.data.session) navigate({ to: "/admin" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
          Le Pacha
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Espace administrateur</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gerez la carte, les prix, les categories et les photos des plats.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Se connecter
          </Button>
        </form>

        <p className="mt-3 text-sm text-muted-foreground">
          La connexion Google est désactivée tant que l&apos;OAuth Supabase n&apos;est pas
          configuré.
        </p>

        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-6">
          <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4">
            Retour au site
          </Link>
        </div>
      </div>
    </main>
  );
}
