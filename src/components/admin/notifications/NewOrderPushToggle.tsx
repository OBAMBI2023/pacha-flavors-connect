import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isPushSupported,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from "@/lib/notifications";
import { isIosSafari, isStandalone } from "@/lib/pwaEnv";

type Status = "idle" | "requesting" | "subscribed" | "denied" | "unsupported";

/**
 * Tenant-facing counterpart to NotificationPermissionCard (which stays
 * exactly as-is for the customer order-tracking flow) -- same underlying
 * engine (src/lib/notifications.ts, register_push_subscription resolves the
 * identity as auth.uid() for a signed-in staff member), different copy and
 * home (/admin's Commandes header, never shown to a customer).
 *
 * Only ever covers the "admin closed" path: when /admin is open and
 * focused, a new order already arrives via useRealtimeOrders (toast/son/
 * vibration/badge) -- this toggle exists purely so the same alert still
 * reaches the tenant as a system Web Push when it isn't.
 */
export function NewOrderPushToggle() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (typeof Notification === "undefined") {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (Notification.permission === "granted") {
      // Idempotent: re-registers/refreshes the existing subscription rather
      // than assuming a prior grant still has a live row server-side.
      void subscribeToNotifications().then((result) => {
        setStatus(result.ok ? "subscribed" : "idle");
      });
    }
  }, []);

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
    setStatus(result.ok ? "subscribed" : "idle");
  }

  async function handleDeactivate() {
    await unsubscribeFromNotifications();
    setStatus("idle");
  }

  if (status === "unsupported") return null;

  if (needsIosInstallFirst) {
    return (
      <p className="text-xs text-muted-foreground">
        Pour recevoir les notifications hors de l'application, installez d'abord SAOVIA Food sur
        votre écran d'accueil (Partager → « Sur l'écran d'accueil »).
      </p>
    );
  }

  if (status === "subscribed") {
    return (
      <Button variant="outline" size="sm" onClick={() => void handleDeactivate()} className="h-11">
        <BellRing className="mr-2 h-4 w-4" /> Notifications push activées
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleActivate()}
        disabled={status === "requesting"}
        className="h-11"
      >
        <Bell className="mr-2 h-4 w-4" />
        {status === "requesting" ? "Activation..." : "Notifications de commandes"}
      </Button>
      {status === "denied" && (
        <span className="text-xs text-destructive">
          Refusées -- à réactiver depuis les réglages du navigateur.
        </span>
      )}
    </div>
  );
}
