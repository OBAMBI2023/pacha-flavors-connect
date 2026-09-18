import { useState } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { NewOrderPushToggle } from "@/components/admin/notifications/NewOrderPushToggle";
import {
  updateOrderNotificationsEnabled,
  useOrderNotificationsEnabled,
} from "@/lib/restaurantSettings";

/**
 * Tenant-level master switch for the whole "nouvelle commande" alert
 * pipeline: RealtimeOrdersBubble, the toast/sound/vibration in
 * useOrdersAlert, and (server-side, via notify_restaurant_new_order) Web
 * Push to staff. Turning this off silences every one of those, everywhere
 * in the app, for this restaurant only -- see the migration comment on
 * order_notifications_enabled for the exact enforcement points.
 *
 * "Notifications navigateur" below is a separate, narrower concern: the
 * browser permission grant that lets Web Push reach this specific device
 * when /admin isn't open or focused. It only makes sense once the master
 * switch above is on, so it's disabled (not hidden -- the tenant should
 * still see it exists) otherwise.
 */
export function OrderNotificationsCard({ restaurantId }: { restaurantId: string }) {
  const queryClient = useQueryClient();
  const { data: enabled, isLoading } = useOrderNotificationsEnabled(restaurantId);
  const [busy, setBusy] = useState(false);

  async function handleToggle(next: boolean) {
    setBusy(true);
    try {
      await updateOrderNotificationsEnabled(restaurantId, next);
      queryClient.setQueryData(["order-notifications-enabled", restaurantId], next);
      toast.success(
        next ? "Notifications de commandes activées" : "Notifications de commandes désactivées",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour le réglage.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Notifications de commandes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez comment vous êtes alerté d'une nouvelle commande.
        </p>
      </div>

      {isLoading || enabled === undefined ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Bulle de commandes en temps réel</p>
            <p className="text-xs text-muted-foreground">
              Recevez instantanément les nouvelles commandes, même lorsque vous n'êtes pas sur le
              dashboard.
            </p>
          </div>
          <Switch checked={enabled} disabled={busy} onCheckedChange={(v) => void handleToggle(v)} />
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm font-medium">Notifications navigateur</p>
        <p className="text-xs text-muted-foreground">
          Recevez une notification système même lorsque SAOVIA Food n'est pas ouvert dans votre
          navigateur ou votre appareil.
        </p>
        {enabled ? (
          <NewOrderPushToggle />
        ) : (
          <p className="text-xs text-muted-foreground">
            Activez d'abord la « Bulle de commandes en temps réel » ci-dessus pour pouvoir activer
            les notifications navigateur.
          </p>
        )}
      </div>
    </Card>
  );
}
