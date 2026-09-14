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
 * A dynamically-imported route chunk 404ing almost always means a new
 * deployment shipped while this tab still had an older build loaded (the
 * exact class of bug this module's other fixes target at the service-worker
 * level -- this is the equivalent safety net for a plain client-side
 * navigation that hits a stale chunk reference, SW involved or not). Vite
 * dispatches this event itself; see
 * https://vitejs.dev/guide/build.html#load-error-handling. Guarded via
 * sessionStorage so a second failure right after the reload can't loop.
 */
function useReloadOnStaleChunkError(): void {
  useEffect(() => {
    function handlePreloadError() {
      const flag = "saovia:reloaded-after-preload-error";
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
      window.location.reload();
    }
    window.addEventListener("vite:preloadError", handlePreloadError);
    return () => window.removeEventListener("vite:preloadError", handlePreloadError);
  }, []);
}

/**
 * `registerType: "prompt"` in vite.config.ts means the new service worker
 * never takes over automatically -- a hard reload mid-checkout would wipe an
 * in-progress cart/order form. The tenant explicitly chooses when to update.
 */
export function PwaUpdatePrompt() {
  useDevServiceWorkerRegistration();
  useReloadOnStaleChunkError();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Fires once for the lifetime of the app (onRegisteredSW itself has no
    // cleanup phase -- PwaUpdatePrompt is mounted once at the root and never
    // unmounts during normal use, same as the original bare setInterval this
    // extends).
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const checkForUpdate = () => void registration.update();
      const oneHour = 60 * 60 * 1000;
      setInterval(checkForUpdate, oneHour);
      // Also check right away whenever the tab regains focus -- a tenant who
      // keeps a tab open for hours/days shouldn't have to wait for the next
      // hourly tick just because they happened to switch away and back.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
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
