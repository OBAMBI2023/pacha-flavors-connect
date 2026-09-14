import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIosSafari, isStandalone } from "@/lib/pwaEnv";

const DISMISSED_ANDROID_KEY = "saovia:pwa-install-dismissed";
const DISMISSED_IOS_KEY = "saovia:pwa-ios-install-dismissed";

/**
 * Opt-in anchor for pages whose own layout leaves no safe zone at the
 * bottom of the initial mobile viewport for a floating bar -- e.g.
 * /food-signup, whose primary CTA already sits at the fold. When a page
 * renders an element with this id, the banner mounts there (normal
 * document flow, so it cannot overlap anything by construction) instead
 * of floating fixed over the bottom of the screen. Pages that don't
 * render this slot get the original fixed-bottom banner, unchanged.
 */
const INLINE_SLOT_ID = "pwa-install-slot";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Uses the official `beforeinstallprompt` mechanism on Android/desktop
 * Chromium browsers -- this event simply never fires on browsers that don't
 * support PWA install (Firefox, etc.), so the button naturally never appears
 * there without any UA-sniffing. iOS has no such API (Apple doesn't expose
 * one), so it gets a separate, honest "Partager > Sur l'écran d'accueil"
 * instruction instead of a fake one-tap button.
 *
 * Hidden on /admin, /super-admin and /auth so it doesn't clutter staff-facing
 * screens.
 */
export function InstallPrompt() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [androidDismissed, setAndroidDismissed] = useState(false);
  const [iosDismissed, setIosDismissed] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [inlineSlot, setInlineSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setAndroidDismissed(window.localStorage.getItem(DISMISSED_ANDROID_KEY) === "true");
    setIosDismissed(window.localStorage.getItem(DISMISSED_IOS_KEY) === "true");
    setShowIos(isIosSafari());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Re-checked per route: the slot only exists in the DOM while a page that
  // renders it (e.g. /food-signup) is mounted.
  useEffect(() => {
    setInlineSlot(document.getElementById(INLINE_SLOT_ID));
  }, [pathname]);

  const hiddenRoute = /^\/(admin|super-admin|auth)(\/|$)/.test(pathname);
  if (hiddenRoute || installed || isStandalone()) return null;

  const wrapperClassName = inlineSlot
    ? "flex items-center gap-3 rounded-2xl border border-cocoa/15 bg-background p-4 shadow-lg"
    : "fixed inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-2xl border border-cocoa/15 bg-background p-4 shadow-lg [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]";

  if (deferredEvent && !androidDismissed) {
    const banner = (
      <div className={wrapperClassName}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cocoa text-gold">
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Installer SAOVIA Food</p>
          <p className="text-xs text-muted-foreground">
            Accédez à SAOVIA Food directement depuis votre écran d'accueil.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            void deferredEvent.prompt();
            void deferredEvent.userChoice.then(() => setDeferredEvent(null));
          }}
        >
          Installer
        </Button>
        <button
          type="button"
          aria-label="Fermer"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent"
          onClick={() => {
            window.localStorage.setItem(DISMISSED_ANDROID_KEY, "true");
            setAndroidDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
    return inlineSlot ? createPortal(banner, inlineSlot) : banner;
  }

  if (showIos && !iosDismissed) {
    const banner = (
      <div className={wrapperClassName}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cocoa text-gold">
          <Share className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-xs text-foreground">
          Pour installer l'application, appuyez sur <strong>Partager</strong> puis{" "}
          <strong>« Sur l'écran d'accueil »</strong>.
        </p>
        <button
          type="button"
          aria-label="Fermer"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent"
          onClick={() => {
            window.localStorage.setItem(DISMISSED_IOS_KEY, "true");
            setIosDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
    return inlineSlot ? createPortal(banner, inlineSlot) : banner;
  }

  return null;
}
