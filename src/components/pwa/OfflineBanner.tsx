import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Purely informational -- never implies an action (like an order) succeeded
 * while offline. Order submission (`createOrder` in orders-db.ts) always
 * awaits a real Supabase response before any confirmation is shown, so this
 * banner has no bearing on that flow.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-cocoa px-4 py-2 text-center text-xs font-medium text-cocoa-foreground"
      style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Vous êtes hors ligne — certaines fonctionnalités sont indisponibles.
    </div>
  );
}
