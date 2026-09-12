import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPushSupported, subscribeToNotifications } from "@/lib/notifications";
import { isIosSafari, isStandalone } from "@/lib/pwaEnv";

const DISMISSED_KEY = "saovia:notification-permission-dismissed";

/**
 * Opt-in card for order-tracking push notifications -- never shown
 * automatically on load without this being the deliberate reason the
 * customer is on the page; permission is only ever requested from the
 * explicit CTA click below, never on mount ("demander la permission
 * uniquement après une action explicite de l'utilisateur").
 *
 * iOS: Web Push only works for a PWA already added to the home screen, so on
 * iOS Safari *not* running standalone this shows install guidance instead of
 * a permission prompt that would silently do nothing.
 */
export function NotificationPermissionCard() {
  const [dismissed, setDismissed] = useState(true);
  const [status, setStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unsupported"
  >("idle");

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setStatus("granted");
    }
  }, []);

  if (dismissed || status === "granted") return null;

  const needsIosInstallFirst = isIosSafari() && !isStandalone();

  async function handleActivate() {
    if (needsIosInstallFirst) return;
    setStatus("requesting");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }
    const result = await subscribeToNotifications();
    setStatus(result.ok ? "granted" : "denied");
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  if (status === "unsupported") return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Recevoir les notifications</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Soyez informé en temps réel de l'état de votre commande.
          </p>

          {needsIosInstallFirst ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Pour activer les notifications sur iPhone, installez d'abord SAOVIA Food sur votre
              écran d'accueil (bouton Partager puis « Sur l'écran d'accueil »).
            </p>
          ) : status === "denied" ? (
            <p className="mt-3 text-xs text-destructive">
              Notifications refusées ou indisponibles. Vous pouvez réessayer depuis les réglages du
              navigateur.
            </p>
          ) : (
            <div className="mt-3 flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => void handleActivate()}
                disabled={status === "requesting"}
              >
                {status === "requesting" ? "Activation…" : "Activer les notifications"}
              </Button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Plus tard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
