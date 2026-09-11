import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Eye, EyeOff, Lock, Mail, Store, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import authHeroImage from "@/assets/saovia-food-auth-hero.png";
import logoMark from "@/assets/saovia-food-logo.png";

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
const ASSISTANCE_WHATSAPP_URL = `https://wa.me/${SAOVIA_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Bonjour Saovia Technologies, j'ai besoin d'assistance sur mon espace Food Partner.",
)}`;

const REMEMBERED_EMAIL_KEY = "saovia_food_partner_remembered_email";

/** Real, shipped capabilities only (commandes, menu/produits, clients CRM --
 * see src/routes/admin.tsx) -- never aspirational copy. */
const BENEFITS = [
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
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  // TEMPORARY diagnostic (non-sensitive) -- see the matching note in
  // AuthPage's useEffect. /admin itself then resolves the actual
  // restaurant_memberships row (useAuth()) and shows a clear "Votre compte
  // n'est pas encore rattaché à un restaurant." message if none exists --
  // this only confirms whether a `profiles` row was found at all.
  console.info("[Auth][diag] resolvePostLoginPath profile lookup", {
    userId,
    profileFound: Boolean(profile),
    isSuperAdmin: profile?.is_super_admin ?? null,
    error: error?.message ?? null,
  });
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [existingSessionEmail, setExistingSessionEmail] = useState<string | null>(null);
  const [existingSessionUserId, setExistingSessionUserId] = useState<string | null>(null);
  // Synchronous single-flight guard for onGoogleSignIn -- a ref (unlike
  // googleBusy state, which only takes effect after React re-renders) so
  // two rapid clicks in the same tick can never both pass the guard and
  // fire two overlapping /authorize requests (points 9/10: a second
  // request would overwrite the first's OAuth state before Google
  // completes it, itself producing a bad_oauth_state-style error).
  const googleSignInInFlight = useRef(false);

  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (remembered) setEmail(remembered);
  }, []);

  useEffect(() => {
    // A Google OAuth redirect (or a magic-link/recovery email) lands back on
    // this exact page with either #access_token=... (implicit flow) or
    // ?code=... (PKCE) appended by Supabase, or -- if Google denied consent
    // or the exchange failed -- an ?error=/#error= param instead. Captured
    // once on mount, before supabase-js's own URL parsing (or our
    // history.replaceState cleanup below) can remove it.
    const initialHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const initialSearch = new URLSearchParams(window.location.search);
    const isOAuthCallback = initialHash.has("access_token") || initialSearch.has("code");
    const oauthErrorCode = initialSearch.get("error_code") || initialHash.get("error_code");
    const oauthErrorDescription =
      initialSearch.get("error_description") ||
      initialHash.get("error_description") ||
      initialSearch.get("error") ||
      initialHash.get("error");

    // TEMPORARY diagnostic logging (non-sensitive only -- never tokens,
    // codes, verifiers or secrets) to trace Google → Supabase /callback →
    // /auth without needing dashboard log access. Safe to remove once the
    // OAuth flow is confirmed stable end-to-end.
    console.info("[Auth][diag] /auth mounted", {
      pathname: window.location.pathname,
      searchParamKeys: [...initialSearch.keys()],
      hashParamKeys: [...initialHash.keys()],
      hasCode: initialSearch.has("code"),
      hasState: initialSearch.has("state") || initialHash.has("state"),
      hasError: Boolean(oauthErrorDescription),
      errorCode: oauthErrorCode,
    });

    if (oauthErrorDescription) {
      // eslint-disable-next-line no-console -- deliberate: point 7 asks for
      // the raw OAuth error to be visible in the browser console for
      // debugging, in addition to the friendly message shown below.
      console.error("[Auth] Google OAuth callback error:", {
        code: oauthErrorCode,
        description: oauthErrorDescription,
      });
      // Case 4: show the real technical reason, not just a generic phrase --
      // a vague "connexion refusée" message would have hidden e.g. a
      // misconfigured Google Client Secret behind wording that looks
      // identical to the user simply cancelling the Google prompt.
      setMessage(
        `La connexion avec Google a échoué : ${oauthErrorDescription}. Réessayez ou contactez le support si le problème persiste.`,
      );
      // Drop the error params from the URL so refreshing this page doesn't
      // keep re-showing a stale error.
      window.history.replaceState(null, "", window.location.pathname);
    }

    supabase.auth.getSession().then(({ data }) => {
      // Intentionally not an automatic navigate() here for a *pre-existing*
      // session: a session found on mount can belong to a completely
      // unrelated visit (e.g. a Marketplace customer whose browser still
      // carries a tenant session from earlier testing) that only reaches
      // /auth indirectly. Auto-redirecting would silently drop them into
      // /admin. Surface it instead and let the visitor opt in. A session
      // that was *just* created by an OAuth redirect is handled separately
      // below, via onAuthStateChange's SIGNED_IN event -- getSession() here
      // can race supabase-js's own async parsing of the callback URL and
      // momentarily report "no session" right after Google sign-in, which
      // is exactly the false-logged-out state this must avoid.
      console.info("[Auth][diag] getSession() on mount", {
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id ?? null,
      });
      setExistingSessionEmail(data.session?.user?.email ?? null);
      setExistingSessionUserId(data.session?.user?.id ?? null);
    });

    // A "Mot de passe oublié" email link lands back on this same page with a
    // recovery token in the URL; supabase-js parses it automatically and
    // fires PASSWORD_RECOVERY once a recovery session is live. SIGNED_IN
    // fires once supabase-js finishes turning a Google OAuth callback URL
    // into a real session -- reacting to the event (rather than only
    // getSession() above) is what guarantees the session is actually ready
    // before this page treats the visitor as logged in and redirects them.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("[Auth][diag] onAuthStateChange", {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        provider: session?.user?.app_metadata?.provider ?? null,
        providerId: session?.user?.identities?.[0]?.id ?? null,
      });

      if (event === "PASSWORD_RECOVERY") {
        setMessage(null);
        setView("recovery");
        return;
      }
      if (event === "SIGNED_IN" && session) {
        setExistingSessionEmail(session.user.email ?? null);
        setExistingSessionUserId(session.user.id ?? null);
        if (isOAuthCallback) {
          setMessage(null);
          resolvePostLoginPath(session.user.id).then((destination) => {
            navigate({ to: destination });
          });
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

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

  /** Real Supabase OAuth -- no custom provider, no hardcoded origin: whatever
   * host this page is currently served from is what Supabase redirects back
   * to. If the Google provider isn't enabled on the project yet, Supabase
   * returns an error here rather than the browser leaving the page, so this
   * surfaces through the same error-message UI as a bad password instead of
   * failing silently. */
  async function onGoogleSignIn() {
    if (busy || googleBusy || googleSignInInFlight.current) return;
    googleSignInInFlight.current = true;
    setGoogleBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      // eslint-disable-next-line no-console -- deliberate, see point 7.
      console.error("[Auth] signInWithOAuth (Google) error:", error);
      googleSignInInFlight.current = false;
      setGoogleBusy(false);
      setMessage("Impossible de continuer avec Google. Réessayez.");
    }
    // On success the browser navigates away to Google immediately -- no
    // further local state update happens (this component unmounts), so
    // googleSignInInFlight is deliberately never reset to false there.
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
    <main className="food-partner-theme min-h-screen bg-background lg:flex lg:items-center lg:justify-center lg:p-8 xl:p-12">
      {/* Grand conteneur centré : coins arrondis + ombre uniquement à partir
          de lg, où les deux panneaux sont côte à côte. En dessous de lg il
          n'y a que le panneau formulaire (le panneau image est masqué), donc
          il occupe tout l'écran sans marge ni arrondi décoratif. */}
      <div className="mx-auto flex w-full max-w-[1400px] flex-col overflow-hidden bg-card lg:min-h-[720px] lg:flex-row lg:rounded-[32px] lg:shadow-[0_30px_80px_-30px_rgba(20,15,10,0.25)]">
        <AuthBrandPanel />

        {/* Right panel: authentication */}
        <div className="relative flex flex-1 flex-col px-5 py-8 sm:items-center sm:justify-center sm:px-8 sm:py-16">
          <div className="w-full sm:max-w-[440px] lg:max-w-[480px]">
          <AuthLogo className="mb-8 justify-center sm:justify-start" />

          <div className="text-center sm:text-left">
            {view === "login" && (
              <>
                <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground xl:text-[2.625rem]">
                  Bienvenue sur <span className="text-primary">SAOVIA</span>
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Connectez-vous à votre espace partenaire.
                </p>
              </>
            )}
            {(view === "forgot" || view === "forgot-sent") && (
              <>
                <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground">
                  Mot de passe oublié
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {view === "forgot"
                    ? "Recevez un lien pour réinitialiser votre mot de passe."
                    : "Vérifiez votre boîte mail."}
                </p>
              </>
            )}
            {view === "recovery" && (
              <>
                <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground">
                  Nouveau mot de passe
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choisissez un nouveau mot de passe.
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
                className="mt-3 h-11 w-full rounded-full"
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
            <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail professionnel</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="votre@email.com"
                    required
                    aria-invalid={Boolean(message) || undefined}
                    aria-describedby={message ? "auth-error" : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-[52px] rounded-xl pl-11"
                  />
                </div>
              </div>

              <PasswordField
                id="password"
                label="Mot de passe"
                placeholder="Votre mot de passe"
                autoComplete="current-password"
                minLength={6}
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
                hasError={Boolean(message)}
              />

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

              {message && (
                <p id="auth-error" role="alert" className="text-sm text-destructive">
                  {message}
                </p>
              )}

              <Button
                type="submit"
                className="h-14 w-full rounded-full text-base font-bold"
                disabled={busy || googleBusy}
              >
                {busy ? (
                  <>
                    <Spinner /> Connexion...
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </Button>

              <AuthDivider />

              <GoogleAuthButton busy={googleBusy} disabled={busy} onClick={() => void onGoogleSignIn()} />

              <p className="pt-2 text-center text-sm text-muted-foreground">
                Vous êtes un nouveau partenaire ?{" "}
                <Link
                  to="/food-signup"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Créer un compte partenaire
                </Link>
              </p>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={onForgotSubmit} className="mt-7 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail professionnel</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="votre@email.com"
                    required
                    aria-invalid={Boolean(message) || undefined}
                    aria-describedby={message ? "auth-error" : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-[52px] rounded-xl pl-11"
                  />
                </div>
              </div>

              {message && (
                <p id="auth-error" role="alert" className="text-sm text-destructive">
                  {message}
                </p>
              )}

              <Button
                type="submit"
                className="h-14 w-full rounded-full text-base font-bold"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Spinner /> Envoi...
                  </>
                ) : (
                  "Envoyer le lien de réinitialisation"
                )}
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
            <div className="mt-7 space-y-5 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                Si un compte existe pour{" "}
                <span className="font-medium text-foreground">{email}</span>, un e-mail contenant un
                lien de réinitialisation vient d&apos;être envoyé.
              </p>
              <Button
                variant="outline"
                className="h-14 w-full rounded-full text-base"
                onClick={() => setView("login")}
              >
                ← Retour à la connexion
              </Button>
            </div>
          )}

          {view === "recovery" && (
            <form onSubmit={onRecoverySubmit} className="mt-7 space-y-5" noValidate>
              <PasswordField
                id="new-password"
                label="Nouveau mot de passe"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={setNewPassword}
                visible={showNewPassword}
                onToggleVisible={() => setShowNewPassword((v) => !v)}
                hasError={Boolean(message)}
              />

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-new-password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  aria-invalid={Boolean(message) || undefined}
                  aria-describedby={message ? "auth-error" : undefined}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="h-[52px] rounded-xl"
                />
              </div>

              {message && (
                <p id="auth-error" role="alert" className="text-sm text-destructive">
                  {message}
                </p>
              )}

              <Button
                type="submit"
                className="h-14 w-full rounded-full text-base font-bold"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Spinner /> Mise à jour...
                  </>
                ) : (
                  "Mettre à jour le mot de passe"
                )}
              </Button>
            </form>
          )}
        </div>

        <div className="mt-8 flex w-full flex-col items-center gap-3 text-center sm:max-w-[440px] lg:max-w-[480px]">
          <Link
            to="/food"
            className="text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            ← Retour à SAOVIA Food
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground/70">
            <span>© {new Date().getFullYear()} SAOVIA Food — Tous droits réservés</span>
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
    </div>
    </main>
  );
}

/** Official SAOVIA Food logo + wordmark -- the single logo asset used
 * site-wide on /food, /food-signup and this project's other public pages
 * (src/assets/saovia-food-logo.png), never a newly generated one. */
function AuthLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={logoMark} alt="" className="h-9 w-9 rounded-full object-cover" />
      <span className="font-display text-xl font-bold tracking-tight text-foreground">
        SAOVIA <span className="text-primary">Food</span>
      </span>
    </div>
  );
}

/** Desktop-only visual panel -- hidden below lg so the mobile flow stays
 * single-column (auth form only), per the brief. The photo (real dish,
 * unedited) fills the panel via object-cover; unlike the previous dark
 * chef-portrait treatment, this reference photo is bright/airy, so the
 * marketing copy sits on a light scrim over its own negative space
 * (top-left) rather than a heavy dark gradient -- closer to the reference's
 * actual mood than reusing the old dark-panel styling would have been. */
function AuthBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-secondary lg:flex lg:w-[58%] lg:flex-col">
      <img
        src={authHeroImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/95 via-white/60 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full flex-col px-10 py-12 xl:px-14 xl:py-14">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <img src={logoMark} alt="" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              SAOVIA <span className="text-primary">Food</span>
            </span>
          </div>

          <h1 className="mt-8 text-balance font-display text-[clamp(2rem,3.2vw,2.75rem)] font-extrabold leading-[1.1] text-foreground">
            Simplifiez la gestion de <span className="text-primary">votre restaurant</span>
          </h1>

          <ul className="mt-8 space-y-5">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <benefit.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{benefit.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  minLength,
  value,
  onChange,
  visible,
  onToggleVisible,
  hasError,
}: {
  id: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  minLength: number;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  hasError: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={minLength}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "auth-error" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[52px] rounded-xl pl-11 pr-11"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function AuthDivider() {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ou</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Real Supabase OAuth trigger (see onGoogleSignIn) -- this button only ever
 * fires supabase.auth.signInWithOAuth, never a custom auth flow. */
function GoogleAuthButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-border bg-transparent text-base font-semibold text-foreground transition-colors hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-60"
    >
      {busy ? <Spinner /> : <GoogleGlyph className="h-5 w-5" />}
      {busy ? "Connexion..." : "Continuer avec Google"}
    </button>
  );
}

function GoogleGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.99-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l3.99 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
    />
  );
}
