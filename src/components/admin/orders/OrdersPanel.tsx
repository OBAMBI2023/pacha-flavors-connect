import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  RadioTower,
  Search,
  Vibrate,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrdersAlert, RealtimeConnectionState } from "@/hooks/useOrdersAlert";
import { useDeliveryDispatch } from "@/hooks/useDeliveryDispatch";
import type { DbRestaurant } from "@/lib/menu-db";
import {
  ORDERS_HISTORY_PAGE_SIZE,
  createRefund,
  fetchOrderPaymentSummary,
  fetchOrderStatusCounts,
  fetchOrdersHistory,
  markCashPaymentReceived,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from "@/lib/orders-db";
import { fetchDriverLocationFreshnessMinutes } from "@/lib/delivery";
import { assignDriverToOrder } from "@/lib/drivers";
import { playTestChime } from "@/lib/order-audio";
import { NewOrderPushToggle } from "@/components/admin/notifications/NewOrderPushToggle";
import {
  resolvePeriod,
  type PeriodPreset,
  type PeriodRange,
} from "@/components/admin/stats/periodPresets";
import { PeriodFilter } from "./PeriodFilter";
import { OrderCard } from "./OrderCard";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { NewOrderDialog } from "./NewOrderDialog";
import { RejectOrderDialog } from "./RejectOrderDialog";
import { RefundDialog } from "./RefundDialog";
import { AssignDriverDialog } from "./AssignDriverDialog";
import { DriverTrackingModal } from "./DriverTrackingModal";
import { FILTER_TABS, STATUS_DOT_CLASS, TERMINAL_STATUSES } from "./orderStatusMeta";

const CONNECTION_META: Record<RealtimeConnectionState, { label: string; dot: string }> = {
  connecting: { label: "Connexion...", dot: "bg-amber-500 animate-pulse" },
  connected: { label: "En direct", dot: "bg-emerald-500" },
  disconnected: { label: "Déconnecté", dot: "bg-muted-foreground/60" },
  error: { label: "Problème de connexion", dot: "bg-destructive animate-pulse" },
};

const TICK_MS = 30_000;

function matchesSearch(order: Order, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return (
    String(order.order_number).includes(q) ||
    order.customer_name.toLowerCase().includes(q) ||
    (digits.length > 0 && order.customer_phone.replace(/\D/g, "").includes(digits))
  );
}

export function OrdersPanel({
  restaurantId,
  restaurant,
  orders,
  connectionState,
  newOrderIds,
  acknowledgeOrder,
  patchOrder,
  loading,
  soundEnabled,
  enableSound,
  disableSound,
  vibrationEnabled,
  vibrationSupported,
  enableVibration,
  disableVibration,
  onBack,
  initialDetailOrderId,
  onInitialDetailHandled,
}: OrdersAlert & {
  restaurantId: string | null;
  restaurant: DbRestaurant | null;
  onBack?: () => void;
  /** One-shot request to open an order's detail sheet directly on mount/update -- set by RealtimeOrdersBubble's "Voir la commande" (admin.tsx owns the state and clears it via onInitialDetailHandled once consumed, so revisiting this tab later never reopens it on its own). */
  initialDetailOrderId?: string | null;
  onInitialDetailHandled?: () => void;
}) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [period, setPeriod] = useState<PeriodPreset>("today");
  const [customRange, setCustomRange] = useState<PeriodRange | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const dispatchByOrderId = useDeliveryDispatch(restaurantId);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundRemaining, setRefundRemaining] = useState(0);
  const [trackingTarget, setTrackingTarget] = useState<Order | null>(null);
  const [assignTarget, setAssignTarget] = useState<Order | null>(null);
  const [freshnessMinutes, setFreshnessMinutes] = useState(5);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [tick, setTick] = useState(0);

  // History mode: any period other than "today" is real order history, not
  // the live realtime board (which only ever holds active orders regardless
  // of age, plus terminal orders from the last 24h -- see fetchRestaurantOrders).
  // Live mode is left completely untouched: same `orders`/realtime/sound
  // pipeline as before this redesign.
  const isHistory = period !== "today";
  const [historyPage, setHistoryPage] = useState(0);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyCounts, setHistoryCounts] = useState<Record<OrderStatus, number> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    void fetchDriverLocationFreshnessMinutes(restaurantId).then(setFreshnessMinutes);
  }, [restaurantId]);

  useEffect(() => {
    if (!initialDetailOrderId) return;
    acknowledgeOrder(initialDetailOrderId);
    setDetailOrderId(initialDetailOrderId);
    onInitialDetailHandled?.();
    // onInitialDetailHandled is expected to clear initialDetailOrderId on the
    // caller's side (admin.tsx) -- omitted from deps so this effect keys only
    // off the id itself, not the callback's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDetailOrderId, acknowledgeOrder]);

  // Debounced search -- 300ms of silence before it takes effect, so typing
  // "BINO" doesn't fire a server query (history mode) or re-filter the whole
  // live list on every keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), search ? 300 : 0);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setHistoryPage(0);
  }, [period, customRange, filter, debouncedSearch]);

  // `tick` is an extra, deliberately-unused dependency: it forces this to
  // recompute every 30s so a session left open across midnight doesn't keep
  // filtering "Aujourd'hui" by yesterday's date window.
  const periodRange = useMemo(() => {
    if (period === "custom") return customRange ?? resolvePeriod("today");
    return resolvePeriod(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customRange, tick]);

  useEffect(() => {
    if (!isHistory || !restaurantId) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError("");
    Promise.all([
      fetchOrdersHistory(restaurantId, {
        from: periodRange.start,
        to: periodRange.end,
        status: filter,
        search: debouncedSearch,
        page: historyPage,
      }),
      fetchOrderStatusCounts(restaurantId, periodRange.start, periodRange.end),
    ])
      .then(([{ orders: rows, total }, counts]) => {
        if (cancelled) return;
        setHistoryOrders(rows);
        setHistoryTotal(total);
        setHistoryCounts(counts);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setHistoryError(
            err instanceof Error ? err.message : "Impossible de charger les commandes.",
          );
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isHistory, restaurantId, periodRange, filter, debouncedSearch, historyPage]);

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
      patchOrder(order.id, {
        status: "cancelled",
        cancel_reason: reason,
        updated_at: new Date().toISOString(),
      });
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
      toast.error(
        err instanceof Error ? err.message : "Impossible de marquer la commande comme payée.",
      );
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
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de charger les paiements de cette commande.",
      );
    }
  }

  async function handleRefund(order: Order, amount: number, reason: string) {
    setBusyOrderId(order.id);
    try {
      const result = await createRefund(order.id, amount, reason || undefined);
      patchOrder(order.id, { payment_status: result.payment_status });
      toast.success(
        `Remboursement de ${amount.toLocaleString("fr-FR")} ${order.currency} enregistré`,
      );
      setRefundTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d'enregistrer le remboursement.",
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleAssign(order: Order, driverId: string) {
    setBusyOrderId(order.id);
    try {
      await assignDriverToOrder(order.id, driverId);
      patchOrder(order.id, {
        assigned_driver_id: driverId,
        delivery_dispatch_status: "assigned",
        driver_delivery_status: "assigned",
      });
      toast.success(`Livreur assigné à la commande #${order.order_number}`);
      setAssignTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'assigner ce livreur.");
    } finally {
      setBusyOrderId(null);
    }
  }

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);

  // Live board scoped to the selected period's date range -- for "today"
  // (the only period live mode ever runs), this narrows the rolling
  // "everything active + last 24h terminal" feed down to strictly today's
  // calendar day, so counts/list match what the period picker promises.
  const periodScopedLiveOrders = useMemo(() => {
    return orders.filter((o) => {
      const createdAt = new Date(o.created_at).getTime();
      return createdAt >= periodRange.start.getTime() && createdAt <= periodRange.end.getTime();
    });
  }, [orders, periodRange]);

  const liveCounts = useMemo(() => {
    const map = new Map<OrderStatus, number>();
    for (const o of periodScopedLiveOrders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return map;
  }, [periodScopedLiveOrders]);

  const liveVisibleOrders = useMemo(() => {
    let list =
      filter === "all"
        ? periodScopedLiveOrders
        : periodScopedLiveOrders.filter((o) => o.status === filter);
    if (debouncedSearch.trim()) list = list.filter((o) => matchesSearch(o, debouncedSearch));
    return [...list].sort((a, b) => {
      const aActive = !TERMINAL_STATUSES.includes(a.status);
      const bActive = !TERMINAL_STATUSES.includes(b.status);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [periodScopedLiveOrders, filter, debouncedSearch]);

  // Unified "counts per status for the current period" and "orders to render"
  // regardless of which mode is active, so the header/chips/list markup below
  // never has to branch on isHistory itself.
  const countFor = (status: OrderStatus): number =>
    isHistory ? (historyCounts?.[status] ?? 0) : (liveCounts.get(status) ?? 0);
  const totalForPeriod = isHistory
    ? Object.values(historyCounts ?? {}).reduce((sum, n) => sum + n, 0)
    : periodScopedLiveOrders.length;
  const visibleOrders = isHistory ? historyOrders : liveVisibleOrders;
  const isLoading = isHistory ? historyLoading : loading;
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / ORDERS_HISTORY_PAGE_SIZE));

  const connection = CONNECTION_META[connectionState];

  return (
    <div className="space-y-4">
      {/* Compact mobile header -- desktop keeps its existing header untouched below. */}
      <div className="flex items-center gap-2 lg:hidden">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold leading-tight">Commandes</h2>
          <p className="truncate text-xs text-muted-foreground">
            {totalForPeriod} commande{totalForPeriod > 1 ? "s" : ""} · Suivez et gérez vos commandes
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Options"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card"
            >
              <MoreVertical className="h-5 w-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem disabled={!restaurantId} onClick={() => setNewOrderDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Nouvelle commande
            </DropdownMenuItem>
            {soundEnabled && (
              <DropdownMenuItem onClick={() => void playTestChime()}>
                <Volume2 className="mr-2 h-4 w-4" aria-hidden="true" /> Tester le son
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => (soundEnabled ? disableSound() : void enableSound())}>
              {soundEnabled ? (
                <BellOff className="mr-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {soundEnabled ? "Désactiver le son" : "Activer les alertes sonores"}
            </DropdownMenuItem>
            {vibrationSupported && (
              <DropdownMenuItem
                onClick={() => (vibrationEnabled ? disableVibration() : enableVibration())}
              >
                <Vibrate className="mr-2 h-4 w-4" aria-hidden="true" />
                {vibrationEnabled ? "Désactiver la vibration" : "Activer la vibration"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="lg:hidden">
        <NewOrderPushToggle />
      </div>

      {/* Desktop header -- unchanged. */}
      <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold leading-tight">Commandes</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm">
            <span className={`h-2 w-2 shrink-0 rounded-full ${connection.dot}`} />
            <span className="font-semibold text-foreground">
              {pendingCount > 0
                ? `${pendingCount} nouvelle${pendingCount > 1 ? "s" : ""} commande${pendingCount > 1 ? "s" : ""}`
                : connection.label}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <RadioTower className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">
            {isHistory ? "Période" : "Aujourd'hui"}
          </span>
          <span className="text-sm font-bold text-foreground">{totalForPeriod}</span>
        </div>
      </div>

      {connectionState === "error" && !isHistory && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          Connexion temps réel interrompue -- tentative de reconnexion automatique en cours.
        </p>
      )}

      <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
        <Button
          size="sm"
          className="h-11"
          disabled={!restaurantId}
          onClick={() => setNewOrderDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Nouvelle commande
        </Button>
        {soundEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => void playTestChime()}
            title="Tester le son"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => (soundEnabled ? disableSound() : void enableSound())}
          title={soundEnabled ? "Son activé" : "Activer les alertes sonores"}
          aria-label={soundEnabled ? "Son activé" : "Activer les alertes sonores"}
        >
          {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
        {vibrationSupported && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => (vibrationEnabled ? disableVibration() : enableVibration())}
            title={vibrationEnabled ? "Vibration activée" : "Activer la vibration"}
            aria-label={vibrationEnabled ? "Vibration activée" : "Activer la vibration"}
          >
            <Vibrate className="h-4 w-4" />
          </Button>
        )}
        <NewOrderPushToggle />
      </div>

      {/* Period + status filters -- real server/client filtering, not just visual. */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter
          preset={period}
          customRange={customRange}
          onChange={(p, range) => {
            setPeriod(p);
            setCustomRange(range);
          }}
        />
        <div className="relative min-w-[10rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher commande, client..."
            className="h-10 pl-9"
          />
        </div>
      </div>

      {/* Status summary + filter -- one scrollable row, doubles as both. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5">
          {FILTER_TABS.map((tab) => {
            const count = tab.id === "all" ? totalForPeriod : countFor(tab.id);
            const selected = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {tab.id !== "all" && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-primary-foreground" : STATUS_DOT_CLASS[tab.id]}`}
                    aria-hidden="true"
                  />
                )}
                {tab.label}
                <span className="text-xs opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {historyError && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {historyError}
        </p>
      )}

      {isLoading && visibleOrders.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Chargement des commandes...
        </p>
      ) : visibleOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <RadioTower className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Aucune commande dans cette vue pour le moment.
          </p>
        </div>
      ) : (
        <div className="min-w-0 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              onTrack={(o) => setTrackingTarget(o)}
              onAssign={(o) => setAssignTarget(o)}
              onRefund={(o) => void openRefundDialog(o)}
            />
          ))}
        </div>
      )}

      {isHistory && historyTotal > ORDERS_HISTORY_PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-11"
            disabled={historyPage === 0 || historyLoading}
            onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Précédent
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {historyPage + 1} / {historyPageCount} · {historyTotal} commande
            {historyTotal > 1 ? "s" : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-11"
            disabled={historyPage + 1 >= historyPageCount || historyLoading}
            onClick={() => setHistoryPage((p) => p + 1)}
          >
            Suivant <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      <NewOrderDialog
        open={newOrderDialogOpen}
        onOpenChange={setNewOrderDialogOpen}
        restaurantId={restaurantId}
        restaurant={restaurant}
      />

      <OrderDetailSheet
        orderId={detailOrderId}
        restaurant={restaurant}
        busy={busyOrderId === detailOrderId}
        onClose={() => setDetailOrderId(null)}
        onAdvance={(o, next) => void handleAdvance(o, next)}
        onReject={(o) => setRejectTarget(o)}
        onMarkPaid={(o) => void handleMarkPaid(o)}
        onRefund={(o) => void openRefundDialog(o)}
        onAssign={(o) => setAssignTarget(o)}
      />

      <AssignDriverDialog
        order={assignTarget}
        currentDriverId={assignTarget?.assigned_driver_id ?? null}
        busy={busyOrderId === assignTarget?.id}
        onCancel={() => setAssignTarget(null)}
        onConfirm={(o, driverId) => void handleAssign(o, driverId)}
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

      <DriverTrackingModal
        order={trackingTarget}
        driverName={
          trackingTarget ? (dispatchByOrderId.get(trackingTarget.id)?.driver_name ?? null) : null
        }
        freshnessMinutes={freshnessMinutes}
        onClose={() => setTrackingTarget(null)}
      />
    </div>
  );
}
