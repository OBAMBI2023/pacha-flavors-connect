import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChefHat,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Store,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const TITLE = "Connexion | SAOVIA Food Partner";
const DESCRIPTION =
  "Accedez a votre espace SAOVIA Food Partner pour gerer votre restaurant, vos commandes et votre menu.";

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

const SAOVIA_WHATSAPP_NUMBER = "2250758483726";
const PARTNER_WHATSAPP_URL = `https://wa.me/${SAOVIA_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Bonjour Saovia Technologies, je souhaite devenir partenaire Food Partner (restaurant).",
)}`;
const ASSISTANCE_WHATSAPP_URL = `https://wa.me/${SAOVIA_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Bonjour Saovia Technologies, j'ai besoin d'assistance sur mon espace Food Partner.",
)}`;

const REMEMBERED_EMAIL_KEY = "saovia_food_partner_remembered_email";

const FEATURES = [
  {
    icon: Store,
    title: "Gestion simplifiée",
    description: "Gérez votre menu, vos prix et vos disponibilités facilement.",
  },
  {
    icon: Bell,
    title: "Commandes en temps réel",
    description: "Recevez et suivez vos commandes depuis votre espace partenaire.",
  },
  {
    icon: TrendingUp,
    title: "Développez votre activité",
    description: "Touchez davantage de clients grâce à SAOVIA.",
  },
] as const;

/**
 * Resolves where a signed-in user belongs, from the same DB-backed sources of
 * truth the route guards themselves check (`profiles.is_super_admin` for
 * `/super-admin`, an active `restaurant_memberships` row for `/admin`) --
 * never from the login form's input or anything client-supplied. Super admin
 * takes priority so a super admin who also happens to hold a restaurant
 * membership still lands in their own space, per SAOVIA's "exclusively"
 * requirement.
 */
async function resolvePostLoginPath(userId: string): Promise<"/super-admin" | "/admin"> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  return profile?.is_super_admin ? "/super-admin" : "/admin";
}

function validateNewPassword(password: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}

type View = "login" | "forgot" | "forgot-sent" | "recovery";

function AuthPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existingSessionEmail, setExistingSessionEmail] = useState<string | null>(null);
  const [existingSessionUserId, setExistingSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (remembered) setEmail(remembered);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Intentionally not an automatic navigate() here: a session found on
      // mount can belong to a completely unrelated visit (e.g. a Marketplace
      // customer whose browser still carries a tenant session from earlier
      // testing) that only reaches /auth indirectly. Auto-redirecting would
      // silently drop them into /admin. Surface it instead and let the
      // visitor opt in.
      setExistingSessionEmail(data.session?.user?.email ?? null);
      setExistingSessionUserId(data.session?.user?.id ?? null);
    });

    // A "Mot de passe oublié" email link lands back on this same page with a
    // recovery token in the URL; supabase-js parses it automatically and
    // fires this event once a recovery session is live.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMessage(null);
        setView("recovery");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setBusy(false);
      setMessage("E-mail ou mot de passe incorrect.");
      return;
    }
    if (rememberMe) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    const userId = result.data.session?.user?.id;
    const destination = userId ? await resolvePostLoginPath(userId) : "/admin";
    setBusy(false);
    if (result.data.session) navigate({ to: destination });
  }

  async function onForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email) return;
    setBusy(true);
    setMessage(null);
    // Same success message whether or not the address has an account, so the
    // form never confirms/denies an email's existence.
    await supabase.auth
      .resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` })
      .catch(() => {});
    setBusy(false);
    setView("forgot-sent");
  }

  async function onRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validationError = validateNewPassword(newPassword);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setMessage("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setBusy(false);
      setMessage("Impossible de mettre à jour le mot de passe. Réessayez.");
      return;
    }
    const userId = data.user?.id;
    const destination = userId ? await resolvePostLoginPath(userId) : "/admin";
    setBusy(false);
    navigate({ to: destination });
  }

  return (
    <main className="food-partner-theme flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Left panel: brand + value props. Hidden below lg to keep the mobile flow single-column. */}
      <aside className="hidden lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:px-14 lg:py-14 xl:px-20">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight text-foreground">
            SAOVIA
            <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              Food Partner
            </span>
          </p>

          <h1 className="mt-10 max-w-md text-balance-title font-display text-4xl font-semibold leading-tight text-foreground xl:text-[2.75rem]">
            Bienvenue dans votre <span className="text-primary">espace partenaire</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Gérez votre restaurant, vos commandes, votre menu et votre activité SAOVIA depuis un
            seul espace.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{feature.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative food-forward composition -- no stock photo asset in the
            repo to draw on, so this is a brand-toned illustration rather than
            a real photograph. */}
        <div className="relative mt-12 h-56 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-secondary to-accent xl:h-64">
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          <div className="absolute -bottom-10 -right-6 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed
              className="h-16 w-16 text-primary/40"
              aria-hidden="true"
              strokeWidth={1.25}
            />
          </div>
        </div>
      </aside>

      {/* Right panel: auth card */}
      <div className="flex flex-1 flex-col px-5 py-8 sm:items-center sm:justify-center sm:px-8 sm:py-16">
        {/* Mobile-only brand mark, since the left panel is hidden here */}
        <div className="mb-6 flex items-center gap-2 sm:hidden">
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            SAOVIA
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-primary">
            Food Partner
          </span>
        </div>

        <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm sm:max-w-[440px] sm:p-8 lg:max-w-[480px] xl:max-w-[620px] xl:p-12">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
              <ChefHat className="h-7 w-7" aria-hidden="true" />
            </span>

            {view === "login" && (
              <>
                <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
                  Connexion
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Accédez à votre espace Food Partner
                </p>
              </>
            )}
            {(view === "forgot" || view === "forgot-sent") && (
              <>
                <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
                  Mot de passe oublié
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {view === "forgot"
                    ? "Recevez un lien pour réinitialiser votre mot de passe"
                    : "Vérifiez votre boîte mail"}
                </p>
              </>
            )}
            {view === "recovery" && (
              <>
                <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
                  Nouveau mot de passe
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choisissez un nouveau mot de passe
                </p>
              </>
            )}
          </div>

          {existingSessionEmail && view === "login" && (
            <div className="mt-6 rounded-2xl border border-border bg-secondary/60 p-4 text-sm">
              <p className="text-muted-foreground">
                Vous êtes déjà connecté en tant que{" "}
                <span className="font-medium text-foreground">{existingSessionEmail}</span>.
              </p>
              <Button
                className="mt-3 h-11 w-full"
                onClick={async () => {
                  const destination = existingSessionUserId
                    ? await resolvePostLoginPath(existingSessionUserId)
                    : "/admin";
                  navigate({ to: destination });
                }}
              >
                Accéder à mon espace
              </Button>
            </div>
          )}

          {view === "login" && (
            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail professionnel</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@restaurant.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    aria-label="Se souvenir de moi"
                  />
                  Se souvenir de moi
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setView("forgot");
                  }}
                  className="text-sm font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {message && <p className="text-sm text-destructive">{message}</p>}

              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy ? (
                  "Connexion..."
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </Button>

              <p className="pt-2 text-center text-sm text-muted-foreground">
                Vous êtes un nouveau partenaire ?{" "}
                <a
                  href={PARTNER_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Créer un compte partenaire
                </a>
              </p>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={onForgotSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail professionnel</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@restaurant.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              {message && <p className="text-sm text-destructive">{message}</p>}

              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy ? "Envoi..." : "Envoyer le lien de réinitialisation"}
              </Button>

              <button
                type="button"
                onClick={() => setView("login")}
                className="block w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                ← Retour à la connexion
              </button>
            </form>
          )}

          {view === "forgot-sent" && (
            <div className="mt-7 space-y-5 text-center">
              <p className="text-sm text-muted-foreground">
                Si un compte existe pour{" "}
                <span className="font-medium text-foreground">{email}</span>, un e-mail contenant un
                lien de réinitialisation vient d&apos;être envoyé.
              </p>
              <Button
                variant="outline"
                className="h-12 w-full text-base"
                onClick={() => setView("login")}
              >
                ← Retour à la connexion
              </Button>
            </div>
          )}

          {view === "recovery" && (
            <form onSubmit={onRecoverySubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-12 pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={
                      showNewPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    aria-pressed={showNewPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-new-password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="h-12"
                />
              </div>

              {message && <p className="text-sm text-destructive">{message}</p>}

              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy ? "Mise à jour..." : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          )}
        </div>

        <div className="mt-8 flex w-full flex-col items-center gap-3 text-center sm:max-w-[440px] lg:max-w-[480px] xl:max-w-[620px]">
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            ← Retour à SAOVIA
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground/70">
            <span>© {new Date().getFullYear()} SAOVIA — Tous droits réservés</span>
            <span aria-hidden="true">·</span>
            <span>Conditions d&apos;utilisation</span>
            <span aria-hidden="true">·</span>
            <span>Politique de confidentialité</span>
            <span aria-hidden="true">·</span>
            <a
              href={ASSISTANCE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Assistance
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
