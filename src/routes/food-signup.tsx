import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, Store, TrendingUp, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signupRestaurant } from "@/lib/restaurantSignup";
import {
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  SAOVIA_SUPPORT_WHATSAPP_NUMBER,
} from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoMark from "@/assets/saovia-food-favicon-mark.png";
import chefImage from "@/assets/saovia-food-signup-chef.png";

const TITLE = "Créer votre compte — SAOVIA Food";
const DESCRIPTION =
  "Créez votre compte SAOVIA Food et lancez votre restaurant en quelques minutes.";

const ADVISOR_WHATSAPP_URL = buildWhatsAppUrl(
  SAOVIA_SUPPORT_WHATSAPP_NUMBER,
  "Bonjour Saovia Technologies, je souhaite parler à un conseiller au sujet de SAOVIA Food.",
);

export const Route = createFileRoute("/food-signup")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FoodSignupPage,
});

/**
 * Marketing column value props. Deliberately qualitative, not numeric -- a
 * prior version of this same request also asked for a "500+ restaurants /
 * 1M+ commandes / +60% croissance" stat bar, which this page does not
 * render: there is no real data anywhere in this project backing those
 * numbers (six restaurants, ~115 orders total), and inventing one would
 * misrepresent SAOVIA Food to a prospective partner. See FEATURES in
 * src/routes/food.tsx for the same real-capabilities-only rule.
 */
const MARKETING_FEATURES = [
  { icon: Store, title: "Gestion simplifiée", description: "Menu, commandes, clients" },
  { icon: Eye, title: "Plus de visibilité", description: "Attirez de nouveaux clients" },
  { icon: TrendingUp, title: "Augmentez vos ventes", description: "En ligne et sur place" },
] as const;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Loose international validity check (matches this app's own WhatsApp-number normalization, not a strict E.164 parser). */
function isValidPhone(value: string): boolean {
  const digits = normalizeWhatsAppPhone(value).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

type View = "form" | "confirmation-pending" | "success";

type FieldErrors = {
  restaurantName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
};

const INPUT_CLASS =
  "h-14 rounded-[14px] border-black/10 bg-white/70 pl-11 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

function FoodSignupPage() {
  const [view, setView] = useState<View>("form");

  const [restaurantName, setRestaurantName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!restaurantName.trim()) errors.restaurantName = "Le nom du restaurant est requis.";
    if (!fullName.trim()) errors.fullName = "Votre nom complet est requis.";
    if (!phone.trim()) errors.phone = "Le numéro WhatsApp est requis.";
    else if (!isValidPhone(phone))
      errors.phone = "Numéro invalide -- utilisez un numéro ivoirien ou international valide.";
    if (!email.trim()) errors.email = "L'adresse e-mail est requise.";
    else if (!isValidEmail(email)) errors.email = "Adresse e-mail invalide.";
    if (!password) errors.password = "Le mot de passe est requis.";
    else if (password.length < 8)
      errors.password = "Le mot de passe doit contenir au moins 8 caractères.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // prevents duplicate submission (double-click/double-submit)
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      // Normalized once here (this app's canonical digits-only WhatsApp
      // format, e.g. "2250758483726") so every downstream consumer --
      // restaurants.phone/whatsapp_phone, the signUp metadata read back on
      // first login -- stores/receives the same shape the rest of the app
      // already expects (see src/lib/whatsapp.ts).
      const normalizedPhone = normalizeWhatsAppPhone(phone.trim());

      // restaurant_name/full_name/phone travel in the signUp metadata so
      // they survive until the user actually has a session -- this project
      // requires email confirmation (see delivery.signup.tsx), so signUp
      // rarely returns one here. Restaurant creation then completes on
      // first login (src/routes/auth.tsx), which reads this metadata back
      // out once a real session exists -- same deferred pattern already
      // used for SAOVIA Delivery's organization signup.
      const signUpResult = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: normalizedPhone,
            restaurant_name: restaurantName.trim(),
          },
        },
      });
      if (signUpResult.error) throw signUpResult.error;

      if (!signUpResult.data.session) {
        setView("confirmation-pending");
        return;
      }

      // Only reached if this project's Supabase Auth is configured without
      // email confirmation -- completes restaurant creation immediately.
      await signupRestaurant({
        restaurantName: restaurantName.trim(),
        fullName: fullName.trim(),
        phone: normalizedPhone,
        email: email.trim(),
      });
      setView("success");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Impossible de créer votre compte. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (view === "confirmation-pending") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#FBF6EF] px-4 py-16 sm:px-6">
        <div className="w-full max-w-md rounded-[28px] border border-[#EFE6D8] bg-white p-8 text-center shadow-[0_20px_60px_-20px_rgba(20,33,61,0.18)]">
          <img src={logoMark} alt="" className="mx-auto h-12 w-12 rounded-full object-cover" />
          <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
            SAOVIA Food
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">
            Vérifiez votre boîte mail
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Un e-mail de confirmation a été envoyé à{" "}
            <span className="font-medium text-foreground">{email}</span>. Cliquez sur le lien qu'il
            contient, puis connectez-vous pour terminer la création de votre compte restaurant.
          </p>
          <Button asChild className="mt-6 h-12 w-full rounded-full">
            <Link to="/auth">Aller à la connexion</Link>
          </Button>
          <a
            href={ADVISOR_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Parler à un conseiller sur WhatsApp
          </a>
        </div>
      </main>
    );
  }

  if (view === "success") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#FBF6EF] px-4 py-16 sm:px-6">
        <div className="w-full max-w-md rounded-[28px] border border-[#EFE6D8] bg-white p-8 text-center shadow-[0_20px_60px_-20px_rgba(20,33,61,0.18)]">
          <p className="font-display text-3xl">🎉</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">
            Bienvenue sur SAOVIA Food !
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Votre compte est prêt. Configurons maintenant votre restaurant.
          </p>
          <Button asChild className="mt-6 h-12 w-full rounded-full">
            <Link to="/admin">
              Configurer mon restaurant <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <a
            href={ADVISOR_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Parler à un conseiller sur WhatsApp
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1B120C]">
      {/* Single continuous ambient background (warm restaurant glow, not a
          photo) -- deliberately not a second panel/photo, so there is no
          seam anywhere behind the marketing text, the chef cutout, or the
          glass form card: all three sit on the exact same backdrop. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2A1810] via-[#1B120C] to-black" />
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute -right-24 bottom-0 h-[460px] w-[460px] rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* --------------------------------------------------------- Top nav */}
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12 lg:py-7">
          <Link to="/food" className="inline-flex items-center gap-2.5">
            <img
              src={logoMark}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30"
            />
            <span className="font-display text-lg font-bold tracking-tight text-white">
              SAOVIA
              <span className="ml-1.5 align-middle text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-primary">
                Food
              </span>
            </span>
          </Link>
          <p className="text-sm text-white/80">
            Déjà un compte ?{" "}
            <Link
              to="/auth"
              className="font-semibold text-primary hover:underline underline-offset-4"
            >
              Se connecter →
            </Link>
          </p>
        </div>

        {/* ---------------------------------------------------- Unified scene */}
        <div className="relative flex flex-1 flex-col px-5 pb-10 sm:px-8 lg:flex-row lg:items-center lg:px-12 lg:pb-0 xl:px-16">
          {/* Marketing column */}
          <div className="max-w-xl lg:w-[58%] lg:pr-4 xl:pr-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
              Plus qu'une plateforme
            </p>
            <h1 className="mt-3 text-balance font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-[3.25rem]">
              Un partenaire pour la croissance de{" "}
              <span className="text-primary">votre restaurant</span>.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
              Gérez, développez et faites grandir votre restaurant avec SAOVIA Food.
            </p>

            <div className="mt-8 space-y-5">
              {MARKETING_FEATURES.map((feature) => (
                <div key={feature.title} className="flex items-start gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{feature.title}</p>
                    <p className="text-sm text-white/65">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chef -- the bridging element between marketing and form. Real
              <img>, vignette-feathered (soft alpha fade on three edges, hard
              on the bottom so he reads as grounded), never boxed in a card,
              never stretched (object-contain, natural proportions
              preserved). At lg+ it leaves normal flow and is centered on the
              boundary between the two columns so it visually overlaps the
              form card's left edge, exactly as asked -- everywhere below lg
              it just sits in-flow between the marketing text and the form,
              per the required mobile order. */}
          <img
            src={chefImage}
            alt="Chef partenaire SAOVIA Food, bras croisés, souriant dans son restaurant"
            className="pointer-events-none relative z-20 mx-auto -mt-2 h-[42vh] w-auto max-w-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)] sm:h-[50vh] lg:absolute lg:inset-y-0 lg:left-[58%] lg:mx-0 lg:my-auto lg:h-[88%] lg:max-h-[46rem] lg:-translate-x-[42%]"
          />

          {/* Form column -- glass card floating on the same background, no
              opaque/white page split. */}
          <div className="relative z-30 mx-auto mt-4 w-full max-w-[480px] lg:mx-0 lg:ml-auto lg:mt-0 lg:w-[42%]">
            <div className="rounded-[28px] border border-white/[0.65] bg-white/[0.88] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.20)] backdrop-blur-[16px] sm:p-8">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
                  Rejoignez la famille SAOVIA
                </p>
                <h1 className="mt-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">
                  Créez votre compte SAOVIA <span className="text-primary">Food</span>
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Lancez votre restaurant en quelques minutes et commencez à recevoir des commandes.
                </p>
              </div>

              <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="restaurant-name">Nom du restaurant</Label>
                  <div className="relative">
                    <Store
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="restaurant-name"
                      placeholder="Ex. Le Goût d'Abidjan"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      className={INPUT_CLASS}
                      aria-invalid={Boolean(fieldErrors.restaurantName)}
                    />
                  </div>
                  {fieldErrors.restaurantName && (
                    <p className="text-xs text-destructive">{fieldErrors.restaurantName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full-name">Votre nom complet</Label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="full-name"
                      placeholder="Ex. Koffi Jean"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={INPUT_CLASS}
                      aria-invalid={Boolean(fieldErrors.fullName)}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Numéro WhatsApp</Label>
                  <div className="relative">
                    <Phone
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Ex. +225 07 12 34 56"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={INPUT_CLASS}
                      aria-invalid={Boolean(fieldErrors.phone)}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Ex. votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={INPUT_CLASS}
                      aria-invalid={Boolean(fieldErrors.email)}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${INPUT_CLASS} pr-11`}
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                      }
                      aria-pressed={showPassword}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive">{fieldErrors.password}</p>
                  )}
                </div>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

                <Button
                  type="submit"
                  className="h-14 w-full rounded-[16px] bg-[#B45309] text-base font-bold shadow-[0_12px_30px_-8px_rgba(180,83,9,0.55)] hover:bg-[#B45309]/90"
                  disabled={busy}
                >
                  {busy ? (
                    "Créer mon compte…"
                  ) : (
                    <>
                      Créer mon compte gratuitement{" "}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </Button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Vos données sont sécurisées.
                </p>
              </form>
            </div>

            <p className="mt-4 text-center text-xs text-white/70">
              En créant votre compte, vous acceptez les Conditions d'utilisation et la Politique de
              confidentialité de SAOVIA Food.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
