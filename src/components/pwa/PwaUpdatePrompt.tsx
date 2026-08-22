import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * `registerType: "prompt"` in vite.config.ts means the new service worker
 * never takes over automatically -- a hard reload mid-checkout would wipe an
 * in-progress cart/order form. The tenant explicitly chooses when to update.
 */
export function PwaUpdatePrompt() {
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
