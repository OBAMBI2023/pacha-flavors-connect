import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Bell, ClipboardList, Tag, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";
import {
  fetchClientNotifications,
  markClientNotificationRead,
  notifyClientNotificationRead,
  type ClientNotification,
} from "@/lib/clientNotifications";
import { markOfferRead, notifyOfferRead } from "@/lib/offers";

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

const TYPE_ICON = { order_confirmed: ClipboardList, order_status_update: ClipboardList, delivery_update: Truck, new_offer: Tag } as const;

export function TenantNotificationsSheet({
  slug,
  open,
  onOpenChange,
  onOpenOffer,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Deep-links into the Offers sheet for a "new_offer" notification. */
  onOpenOffer: (offerId: string) => void;
}) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchClientNotifications(slug, getOrCreateVisitorId())
      .then((rows) => { if (!cancelled) setNotifications(rows); })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de charger les notifications."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, slug]);

  function select(notification: ClientNotification) {
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));

    if (notification.link_type === "offer" && notification.link_id) {
      void markOfferRead(notification.link_id, getOrCreateVisitorId()).then(notifyOfferRead);
      onOpenChange(false);
      onOpenOffer(notification.link_id);
      return;
    }

    void markClientNotificationRead(notification.id, getOrCreateVisitorId()).then(notifyClientNotificationRead);
    if (notification.link_type === "order" && notification.link_id) {
      onOpenChange(false);
      navigate({ to: "/commande/$orderId/confirmation", params: { orderId: notification.link_id } });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[85vh] flex-col rounded-t-[20px] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Notifications</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => select(n)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left shadow-sm ${
                      n.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{n.title}</p>
                        {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
