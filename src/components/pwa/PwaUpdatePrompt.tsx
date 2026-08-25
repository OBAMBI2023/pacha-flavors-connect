import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * vite-plugin-pwa's dev-mode useRegisterSW() is a no-op stub (no real
 * navigator.serviceWorker.register() call) when injectRegister:false is
 * set -- confirmed by reading dist/client/dev/react.js. This mirrors the
 * registration the plugin would have auto-injected via
 * generateRegisterDevSW() if injectRegister weren't false. Dev-only; the
 * production build path (client/build/react.js) already registers for real.
 */
function useDevServiceWorkerRegistration(): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
  }, []);
}

/**
 * `registerType: "prompt"` in vite.config.ts means the new service worker
 * never takes over automatically -- a hard reload mid-checkout would wipe an
 * in-progress cart/order form. The tenant explicitly chooses when to update.
 */
export function PwaUpdatePrompt() {
  useDevServiceWorkerRegistration();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const oneHour = 60 * 60 * 1000;
      setInterval(() => void registration.update(), oneHour);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast("Nouvelle version disponible", {
      id: "pwa-update-available",
      duration: Infinity,
      action: { label: "Actualiser", onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;
    toast.success("Application prête pour une utilisation hors ligne", { id: "pwa-offline-ready" });
  }, [offlineReady]);

  return null;
}
