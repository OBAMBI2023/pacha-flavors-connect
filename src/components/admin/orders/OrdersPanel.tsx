import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, RadioTower, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrdersAlert, RealtimeConnectionState } from "@/hooks/useOrdersAlert";
import { useDeliveryDispatch } from "@/hooks/useDeliveryDispatch";
import { createRefund, fetchOrderPaymentSummary, markCashPaymentReceived, updateOrderStatus, type Order, type OrderStatus } from "@/lib/orders-db";
import { playTestChime } from "@/lib/order-audio";
import { OrderCard } from "./OrderCard";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { RejectOrderDialog } from "./RejectOrderDialog";
import { RefundDialog } from "./RefundDialog";
import { FILTER_TABS, TERMINAL_STATUSES } from "./orderStatusMeta";

const CONNECTION_META: Record<RealtimeConnectionState, { label: string; dot: string }> = {
  connecting: { label: "Connexion...", dot: "bg-amber-500 animate-pulse" },
  connected: { label: "En direct", dot: "bg-emerald-500" },
  disconnected: { label: "Déconnecté", dot: "bg-muted-foreground/60" },
  error: { label: "Problème de connexion", dot: "bg-destructive animate-pulse" },
};

const TICK_MS = 30_000;

export function OrdersPanel({
  restaurantId,
  orders,
  connectionState,
  newOrderIds,
  acknowledgeOrder,
  patchOrder,
  loading,
  soundEnabled,
  enableSound,
  disableSound,
}: OrdersAlert & { restaurantId: string | null }) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const dispatchByOrderId = useDeliveryDispatch(restaurantId);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundRemaining, setRefundRemaining] = useState(0);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  async function handleAdvance(order: Order, nextStatus: OrderStatus) {
    setBusyOrderId(order.id);
    acknowledgeOrder(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus);
      patchOrder(order.id, { status: nextStatus, updated_at: new Date().toISOString() });
      toast.success(`Commande #${order.order_number} mise à jour`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour la commande.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleReject(order: Order, reason: string) {
    setBusyOrderId(order.id);
    try {
      await updateOrderStatus(order.id, "cancelled", reason);
      patchOrder(order.id, { status: "cancelled", cancel_reason: reason, updated_at: new Date().toISOString() });
      acknowledgeOrder(order.id);
      toast.success(`Commande #${order.order_number} refusée`);
      setRejectTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de refuser la commande.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleMarkPaid(order: Order) {
    setBusyOrderId(order.id);
    try {
      await markCashPaymentReceived(order.id);
      patchOrder(order.id, { payment_status: "paid", paid_at: new Date().toISOString() });
      toast.success(`Commande #${order.order_number} marquée comme encaissée`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de marquer la commande comme payée.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function openRefundDialog(order: Order) {
    try {
      const summary = await fetchOrderPaymentSummary(order.id);
      setRefundRemaining(summary.remaining);
      setRefundTarget(order);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les paiements de cette commande.");
    }
  }

  async function handleRefund(order: Order, amount: number, reason: string) {
    setBusyOrderId(order.id);
    try {
      const result = await createRefund(order.id, amount, reason || undefined);
      patchOrder(order.id, { payment_status: result.payment_status });
      toast.success(`Remboursement de ${amount.toLocaleString("fr-FR")} ${order.currency} enregistré`);
      setRefundTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer le remboursement.");
    } finally {
      setBusyOrderId(null);
    }
  }

  const counts = useMemo(() => {
    const map = new Map<OrderStatus, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return map;
  }, [orders]);

  const pendingCount = counts.get("pending") ?? 0;

  const visibleOrders = useMemo(() => {
    const list = filter === "all" ? orders : orders.filter((o) => o.status === filter);
    return [...list].sort((a, b) => {
      const aActive = !TERMINAL_STATUSES.includes(a.status);
      const bActive = !TERMINAL_STATUSES.includes(b.status);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, filter]);

  const connection = CONNECTION_META[connectionState];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Commandes</h2>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${connection.dot}`} />
            {connection.label}
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                {pendingCount} en attente
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {soundEnabled && (
            <Button variant="ghost" size="sm" onClick={() => void playTestChime()} title="Tester le son">
              <Volume2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => (soundEnabled ? disableSound() : void enableSound())}
            className="h-11"
          >
            {soundEnabled ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
            {soundEnabled ? "Son activé" : "Activer les alertes sonores"}
          </Button>
        </div>
      </div>

      {connectionState === "error" && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          Connexion temps réel interrompue -- tentative de reconnexion automatique en cours.
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {FILTER_TABS.map((tab) => {
            const count = tab.id === "all" ? orders.length : counts.get(tab.id) ?? 0;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  filter === tab.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {tab.label}
                {count > 0 && <span className="text-xs opacity-80">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chargement des commandes...</p>
      ) : visibleOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <RadioTower className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucune commande dans cette vue pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isNew={newOrderIds.has(order.id)}
              busy={busyOrderId === order.id}
              dispatchProposal={dispatchByOrderId.get(order.id)}
              onOpenDetail={(o) => {
                acknowledgeOrder(o.id);
                setDetailOrderId(o.id);
              }}
              onAdvance={(o, next) => void handleAdvance(o, next)}
              onReject={(o) => setRejectTarget(o)}
              onMarkPaid={(o) => void handleMarkPaid(o)}
            />
          ))}
        </div>
      )}

      <OrderDetailSheet
        orderId={detailOrderId}
        busy={busyOrderId === detailOrderId}
        onClose={() => setDetailOrderId(null)}
        onAdvance={(o, next) => void handleAdvance(o, next)}
        onReject={(o) => setRejectTarget(o)}
        onMarkPaid={(o) => void handleMarkPaid(o)}
        onRefund={(o) => void openRefundDialog(o)}
      />

      <RejectOrderDialog
        order={rejectTarget}
        busy={busyOrderId === rejectTarget?.id}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(o, reason) => void handleReject(o, reason)}
      />

      <RefundDialog
        order={refundTarget}
        remaining={refundRemaining}
        busy={busyOrderId === refundTarget?.id}
        onCancel={() => setRefundTarget(null)}
        onConfirm={(o, amount, reason) => void handleRefund(o, amount, reason)}
      />
    </div>
  );
}
