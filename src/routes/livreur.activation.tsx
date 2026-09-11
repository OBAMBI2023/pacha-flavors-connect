import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase-any";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TITLE = "Activation du compte | Espace livreur SAOVIA";

export const Route = createFileRoute("/livreur/activation")({
  ssr: false,
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DriverActivationPage,
});

function validateNewPassword(password: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}

/** Both the invite link (new driver) and the recovery link ("Renvoyer l'invitation" / forgot password) land here -- supabase-js parses the URL's access token automatically and either fires SIGNED_IN (invite) or PASSWORD_RECOVERY (recovery); either way the driver just needs to set a password once a session exists. */
type PageState = "checking" | "ready" | "invalid" | "done";

function DriverActivationPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("error") || hashParams.get("error_code")) {
      setState("invalid");
      return;
    }

    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (settled) return;
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        settled = true;
        setState("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      if (data.session) {
        settled = true;
        setState("ready");
      }
    });

    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setState((current) => (current === "checking" ? "invalid" : current));
      }
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validationError = validateNewPassword(password);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    if (password !== confirmPassword) {
      setMessage("La confirmation ne correspond pas au mot de passe.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error || !data.user) {
      setBusy(false);
      setMessage("Impossible d'activer le compte. Réessayez ou demandez un nouveau lien à votre restaurant.");
      return;
    }
    // Self-update, permitted by driver_profiles_update -- best-effort: a
    // failure here shouldn't strand a driver who did successfully set their
    // password from reaching their dashboard.
    try {
      await supabase
        .from("driver_profiles")
        .update({ account_status: "active" })
        .eq("id", data.user.id)
        .eq("account_status", "pending_invitation");
    } catch {
      // ignore
    }
    setBusy(false);
    setState("done");
    navigate({ to: "/livreur" });
  }

  return (
    <div className="driver-app-theme">
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mt-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">SAOVIA</p>

          {state === "checking" && (
            <p className="mt-6 text-center text-sm text-muted-foreground">Vérification du lien...</p>
          )}

          {state === "invalid" && (
            <>
              <h1 className="mt-2 text-center font-display text-2xl font-semibold">Lien invalide</h1>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Ce lien d&apos;activation est invalide ou a expiré.
              </p>
              <div className="mt-6 space-y-2">
                <p className="text-center text-xs text-muted-foreground">
                  Demandez à votre restaurant de vous renvoyer une invitation.
                </p>
                <Button variant="outline" className="h-12 w-full" onClick={() => navigate({ to: "/livreur" })}>
                  Retour à la connexion
                </Button>
              </div>
            </>
          )}

          {(state === "ready" || state === "done") && (
            <>
              <h1 className="mt-2 text-center font-display text-2xl font-semibold">Activer votre compte</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">Choisissez votre mot de passe</p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12"
                  />
                </div>
                {message && <p className="text-sm text-destructive">{message}</p>}
                <Button type="submit" className="h-12 w-full" disabled={busy}>
                  {busy ? "Activation..." : "Activer mon compte"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
