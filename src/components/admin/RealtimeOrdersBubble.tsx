import { useEffect, useRef, useState } from "react";
import { ShoppingBag, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OrdersAlert, RealtimeConnectionState } from "@/hooks/useOrdersAlert";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  elapsedLabel,
  fulfillmentLabel,
} from "@/components/admin/orders/orderStatusMeta";

const MAX_PREVIEW_ORDERS = 8;

const CONNECTION_DOT: Record<RealtimeConnectionState, string> = {
  connecting: "bg-amber-500",
  connected: "bg-emerald-500",
  disconnected: "bg-muted-foreground/40",
  error: "bg-red-500",
};

const CONNECTION_LABEL: Record<RealtimeConnectionState, string> = {
  connecting: "Connexion...",
  connected: "En direct",
  disconnected: "Déconnecté",
  error: "Connexion interrompue",
};

function unseenAnnouncement(count: number): string {
  if (count === 0) return "Aucune nouvelle commande non consultée.";
  if (count === 1) return "1 nouvelle commande non consultée.";
  return `${count} nouvelles commandes non consultées.`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export type RealtimeOrdersBubbleProps = Pick<
  OrdersAlert,
  "orders" | "newOrderIds" | "acknowledgeOrder" | "connectionState"
> & {
  /**
   * Opens the existing full orders view (the "Commandes" tab in /admin).
   * With an orderId, also opens that order's own detail sheet directly --
   * this component never renders its own order-detail UI, only a quick
   * preview on top of the real one.
   */
  onOpenOrders: (orderId?: string) => void;
};

/**
 * Persistent floating shortcut to the tenant's live orders, meant to sit at
 * the /admin layout level (next to the Tabs, not inside a TabsContent) so it
 * survives tab switches. Only ever mounted by the caller when the tenant's
 * "Bulle de commandes en temps réel" setting (Paramètres) is on -- see
 * admin.tsx -- so there is nothing to gate internally here.
 *
 * Deliberately stateless with respect to realtime: it consumes the *same*
 * `useOrdersAlert` instance already driving the sidebar/bottom-nav pending
 * badges and the Commandes tab itself, so there is exactly one Supabase
 * Realtime subscription per dashboard, and tenant isolation is inherited
 * from `useRealtimeOrders` (server-side filter + `orders_select_members`
 * RLS) rather than re-implemented here.
 *
 * The unseen badge is `newOrderIds.size` -- the same "new until
 * opened/advanced" set `OrderCard` already uses for its own highlight, not a
 * derived/duplicated notion of "unseen". Opening the panel acknowledges
 * every order currently listed here, mirroring what opening an order's
 * detail sheet already does; it never touches order status.
 */
export function RealtimeOrdersBubble({
  orders,
  newOrderIds,
  acknowledgeOrder,
  connectionState,
  onOpenOrders,
}: RealtimeOrdersBubbleProps) {
  const [open, setOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const prevUnseenRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const unseenCount = newOrderIds.size;
  const badgeLabel = unseenCount > 99 ? "99+" : String(unseenCount);
  const recentOrders = orders.slice(0, MAX_PREVIEW_ORDERS);

  // Fires only when the unseen count *increases* -- a drop to 0 (from
  // opening the panel, or from OrdersPanel's own acknowledgeOrder calls
  // elsewhere) must never re-trigger this "new order arrived" pulse.
  useEffect(() => {
    if (unseenCount > prevUnseenRef.current && !reducedMotion) {
      setPulsing(true);
      const timeout = setTimeout(() => setPulsing(false), 1200);
      prevUnseenRef.current = unseenCount;
      return () => clearTimeout(timeout);
    }
    prevUnseenRef.current = unseenCount;
    return undefined;
  }, [unseenCount, reducedMotion]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // "Vu" is a local UX affordance only (badge -> 0); it never writes to
      // the order itself, so a still-pending order keeps its real status.
      for (const id of newOrderIds) acknowledgeOrder(id);
    }
  }

  function handleSeeAll() {
    setOpen(false);
    onOpenOrders();
  }

  function handleSeeOrder(orderId: string) {
    setOpen(false);
    onOpenOrders(orderId);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <div
        className={cn(
          "fixed z-40 right-4 bottom-[calc(80px+env(safe-area-inset-bottom))]",
          "lg:bottom-6 lg:right-6",
        )}
      >
        <span role="status" aria-live="polite" className="sr-only">
          {unseenAnnouncement(unseenCount)}
        </span>

        {pulsing && (
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-[#155EEF]/50 motion-safe:animate-ping"
            aria-hidden="true"
          />
        )}

        <SheetTrigger
          aria-label="Nouvelles commandes"
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-full lg:h-16 lg:w-16",
            "bg-gradient-to-br from-[#2F6FED] to-[#0B3FCB] text-white",
            "ring-1 ring-white/25 shadow-[0_10px_28px_rgba(11,63,203,0.38)]",
            "backdrop-blur-sm outline-none transition-transform duration-300",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F6FED]",
            "motion-safe:hover:scale-[1.06] motion-safe:active:scale-95",
            pulsing && "motion-safe:scale-110",
          )}
        >
          <ShoppingBag className="h-6 w-6 lg:h-7 lg:w-7" aria-hidden="true" />
          {unseenCount > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute -right-1 -top-1 flex h-6 min-w-[1.5rem] items-center justify-center",
                "rounded-full bg-gradient-to-br from-orange-500 to-red-500 px-1",
                "text-[0.7rem] font-bold leading-none text-white ring-2 ring-white/90",
                pulsing && "motion-safe:animate-pulse",
              )}
            >
              {badgeLabel}
            </span>
          )}
        </SheetTrigger>
      </div>

      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "flex h-[85vh] flex-col rounded-t-2xl p-0"
            : "flex w-full flex-col p-0 sm:max-w-md"
        }
      >
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle>Commandes récentes</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", CONNECTION_DOT[connectionState])}
              aria-hidden="true"
            />
            {CONNECTION_LABEL[connectionState]}
          </SheetDescription>
        </SheetHeader>

        {connectionState === "error" && (
          <p className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            Connexion temps réel interrompue -- reconnexion automatique en cours.
          </p>
        )}

        <div className="flex-1 overflow-y-auto">
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <RadioTower className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
            </div>
          ) : (
            <ul>
              {recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">#{order.order_number}</span>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {elapsedLabel(order.created_at)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
                          STATUS_BADGE_CLASS[order.status],
                        )}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {order.customer_name} · {fulfillmentLabel(order.fulfillment_type)}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatMoney(order.total_amount, order.currency)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0"
                    onClick={() => handleSeeOrder(order.id)}
                  >
                    Voir la commande
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-3">
          <Button variant="ghost" className="w-full" onClick={handleSeeAll}>
            Voir toutes les commandes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
