import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HelpCircle, LogOut, Shield, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { useDriverProposals } from "@/hooks/useDriverProposals";
import { useAudioUnlock } from "@/hooks/useAudioUnlock";
import { useDriverProposalAlert } from "@/hooks/useDriverProposalAlert";
import {
  respondToProposal,
  setDriverAvailability,
  updateDriverLocation,
  fetchDriverTodayStats,
  fetchDriverRecentOrders,
  type DriverActiveDelivery,
  type DriverOrderHistoryEntry,
} from "@/lib/delivery";
import { fetchAgentAssignedDeliveries, type AgentAssignedDelivery } from "@/lib/dispatch";
import {
  partnerConnectionManager,
  driverHeartbeat,
  LOCATION_PUSH_INTERVAL_ACTIVE_MS,
  LOCATION_PUSH_INTERVAL_IDLE_MS,
  inferDriverBusinessStatus,
  useDriverRuntimeStatus,
  subscribeToPush,
} from "@/partner-runtime";
import { ProposalAlertCard } from "@/components/driver/ProposalAlertCard";
import { ActiveDeliveryCard } from "@/components/driver/ActiveDeliveryCard";
import { DriverHeader } from "@/components/driver/DriverHeader";
import { DriverStats, type DriverStatsData } from "@/components/driver/DriverStats";
import { DriverBottomNav, type DriverTab } from "@/components/driver/DriverBottomNav";
import { DriverProfileCard } from "@/components/driver/DriverProfileCard";
import { VehicleCard } from "@/components/driver/VehicleCard";
import { EarningsCard } from "@/components/driver/EarningsCard";
import { MessagesTab } from "@/components/driver/MessagesTab";
import { NotificationsTab } from "@/components/driver/NotificationsTab";
import { ReadinessTab } from "@/components/driver/ReadinessTab";
import { SecondaryScreenHeader } from "@/components/driver/SecondaryScreenHeader";
import { ZonesOpportunitiesCard } from "@/components/driver/ZonesOpportunitiesCard";
import { SaoviaMissionCard } from "@/components/driver/SaoviaMissionCard";
import {
  CompletedDeliveryScreen,
  type CompletedDeliverySummary,
} from "@/components/driver/CompletedDeliveryScreen";
import { DriverTrackingMap } from "@/components/admin/orders/DriverTrackingMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const TITLE = "Espace livreur | SAOVIA";
const BOTTOM_NAV_TABS: ReadonlySet<DriverTab> = new Set([
  "accueil",
  "courses",
  "messages",
  "profil",
]);

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const SAOVIA_MISSION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  pending_pickup: "En attente de collecte",
  assigned_pickup: "Collecte à faire",
  picked_up: "Collectée",
  ready_for_delivery: "Prête pour livraison",
  assigned_delivery: "Livraison à faire",
  in_transit: "En livraison",
  delivered: "Livrée",
  delivery_failed: "Échec de livraison",
  cancelled: "Annulée",
  returned: "Retournée",
};

export const Route = createFileRoute("/livreur")({
  ssr: false,
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DriverPage,
});

function DriverPage() {
  const { session, loading: authLoading, driver } = useDriverAuth();

  if (authLoading) {
    return (
      <div className="driver-app-theme">
        <CenteredMessage>Chargement...</CenteredMessage>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="driver-app-theme">
        <DriverLoginForm />
      </div>
    );
  }
  if (!driver) {
    return (
      <div className="driver-app-theme">
        <CenteredMessage>
          <p>Ce compte n&apos;est pas configuré comme livreur.</p>
          <Button variant="outline" className="mt-4" onClick={() => void supabase.auth.signOut()}>
            Se déconnecter
          </Button>
        </CenteredMessage>
      </div>
    );
  }
  return (
    <div className="driver-app-theme">
      <DriverDashboard driver={driver} initiallyAvailable={driver.status === "available"} />
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-sm text-muted-foreground">
      <div>{children}</div>
    </main>
  );
}

/** Styling only -- the actual auth call (signInWithPassword) is untouched, matching the already-fixed and separately-validated /delivery/login flow. */
function DriverLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="mt-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
          SAOVIA
        </p>
        <h1 className="text-center font-display text-2xl font-semibold">Connexion partenaire</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full rounded-2xl" disabled={busy}>
            {busy ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
        {message && <p className="mt-4 text-center text-sm text-muted-foreground">{message}</p>}
      </div>
    </main>
  );
}

function DriverDashboard({
  driver,
  initiallyAvailable,
}: {
  driver: NonNullable<ReturnType<typeof useDriverAuth>["driver"]>;
  initiallyAvailable: boolean;
}) {
  const driverId = driver.id;
  const [tab, setTab] = useState<DriverTab>("accueil");
  const [available, setAvailable] = useState(initiallyAvailable);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [livePosition, setLivePosition] = useState<{ lat: number; lng: number } | null>(null);
  const [stats, setStats] = useState<DriverStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<DriverOrderHistoryEntry[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [saoviaMissions, setSaoviaMissions] = useState<AgentAssignedDelivery[]>([]);
  const [saoviaMissionsLoading, setSaoviaMissionsLoading] = useState(driver.is_saovia_agent);
  const [completedDelivery, setCompletedDelivery] = useState<CompletedDeliverySummary | null>(null);
  const prevActiveDeliveryRef = useRef<DriverActiveDelivery | null>(null);
  const { pendingProposal, activeDelivery, loading, refresh } = useDriverProposals(driverId);

  useAudioUnlock();
  useDriverProposalAlert(pendingProposal);

  // SAOVIA Partner runtime: the realtime connection link lives for exactly
  // as long as this dashboard is mounted (the driver is actively using the
  // app) -- started/stopped in one place, never left running past unmount.
  useEffect(() => {
    partnerConnectionManager.start();
    return () => partnerConnectionManager.stop();
  }, []);

  // Phase 3 socle: connectionState/presence/heartbeat age, derived from the
  // existing pendingProposal/activeDelivery/available signals below --
  // nothing here reads driver_profiles.status again or opens a new
  // subscription. Not rendered yet (see Phase 3 section 8); this only wires
  // the data so a status pill can be added without further plumbing.
  useDriverRuntimeStatus(
    inferDriverBusinessStatus({
      available,
      hasPendingProposal: Boolean(pendingProposal),
      hasActiveDelivery: Boolean(activeDelivery),
    }),
  );

  // Same tracking cadence/guard logic as before the redesign, unchanged.
  const trackingActive = available || Boolean(activeDelivery);
  const pushIntervalMs = activeDelivery
    ? LOCATION_PUSH_INTERVAL_ACTIVE_MS
    : LOCATION_PUSH_INTERVAL_IDLE_MS;

  useEffect(() => {
    if (!trackingActive) return;
    let cancelled = false;
    let warnedOnce = false;

    function pushLocation() {
      if (!navigator.geolocation) return;
      driverHeartbeat.recordAttempt();
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setLivePosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          void updateDriverLocation(driverId, pos.coords.latitude, pos.coords.longitude)
            .then(() => driverHeartbeat.recordSuccess())
            .catch(() => driverHeartbeat.recordFailure());
        },
        () => {
          driverHeartbeat.recordFailure();
          if (!warnedOnce) {
            warnedOnce = true;
            toast.error(
              "Position indisponible -- autorisez la géolocalisation pour recevoir des courses.",
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 20_000, timeout: 15_000 },
      );
    }

    pushLocation();
    const id = setInterval(pushLocation, pushIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [trackingActive, pushIntervalMs, driverId]);

  // Real, RLS-scoped numbers -- refetched whenever the live proposal/active
  // delivery reference changes (accept/refuse/status-advance all flow
  // through useDriverProposals' own realtime refresh), so the KPIs and the
  // history list stay honest without a separate polling loop.
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setOrdersLoading(true);
    Promise.all([fetchDriverTodayStats(driverId), fetchDriverRecentOrders(driverId)])
      .then(([s, orders]) => {
        if (cancelled) return;
        setStats(s);
        setRecentOrders(orders);
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setStatsLoading(false);
        setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [driverId, activeDelivery, pendingProposal]);

  async function loadSaoviaMissions() {
    if (!driver.is_saovia_agent) return;
    let cancelled = false;
    setSaoviaMissionsLoading(true);
    try {
      const missions = await fetchAgentAssignedDeliveries();
      if (!cancelled) setSaoviaMissions(missions);
    } catch {
      // ignore: the page already shows an empty/error-free state
    } finally {
      if (!cancelled) setSaoviaMissionsLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }

  // Only wired for SAOVIA agents (driver_profiles.is_saovia_agent) -- a
  // tenant restaurant driver never has missions here, so this stays a no-op
  // request-free branch for them, not an empty state that implies a feature.
  useEffect(() => {
    if (!driver.is_saovia_agent) return;
    let cancelled = false;
    setSaoviaMissionsLoading(true);
    fetchAgentAssignedDeliveries()
      .then((missions) => {
        if (!cancelled) setSaoviaMissions(missions);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSaoviaMissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [driver.is_saovia_agent, driverId]);

  // Detects a real completion: the previous activeDelivery was at
  // 'delivered' and get_driver_active_delivery() now returns nothing for it
  // (it only ever returns non-terminal deliveries). Nothing here is
  // speculative -- both the previous snapshot and the transition are the
  // same real payload/hook already driving the rest of this page.
  useEffect(() => {
    const prev = prevActiveDeliveryRef.current;
    if (prev && prev.driver_delivery_status === "delivered" && !activeDelivery) {
      setCompletedDelivery({
        order_number: prev.order_number,
        restaurant_name: prev.restaurant_name,
        delivery_distance_km: prev.delivery_distance_km,
      });
    }
    prevActiveDeliveryRef.current = activeDelivery;
  }, [activeDelivery]);

  async function toggleAvailability() {
    const next = !available;
    // The one and only place Notification permission is ever requested --
    // Phase 5 hangs the actual push subscription off this same explicit
    // action, never on page load.
    if (next && typeof Notification !== "undefined") {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission().catch(
          () => "denied" as NotificationPermission,
        );
      }
      if (permission === "granted") {
        void subscribeToPush(driverId).catch(() => {});
      }
    }
    setTogglingAvailability(true);
    try {
      await setDriverAvailability(driverId, next);
      setAvailable(next);
      toast.success(next ? "Vous êtes disponible" : "Vous êtes hors ligne");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour votre statut.");
    } finally {
      setTogglingAvailability(false);
    }
  }

  async function handleRespond(proposalId: string, accept: boolean) {
    setRespondingTo(proposalId);
    try {
      const result = await respondToProposal(proposalId, accept);
      if (accept && result.status === "accepted") toast.success("Livraison acceptée");
      else if (!accept) toast("Proposition refusée");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cette proposition n'est plus disponible.");
      await refresh();
    } finally {
      setRespondingTo(null);
    }
  }

  const showBottomNav = !completedDelivery && BOTTOM_NAV_TABS.has(tab);

  return (
    <main className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        {completedDelivery ? (
          <CompletedDeliveryScreen
            delivery={completedDelivery}
            onDone={() => {
              setCompletedDelivery(null);
              setTab("accueil");
            }}
          />
        ) : (
          <>
            {tab === "accueil" && (
              <AccueilTab
                driver={driver}
                available={available}
                togglingAvailability={togglingAvailability}
                onToggleAvailability={() => void toggleAvailability()}
                livePosition={livePosition}
                stats={stats}
                statsLoading={statsLoading}
                loading={loading}
                activeDelivery={activeDelivery}
                pendingProposal={pendingProposal}
                respondingTo={respondingTo}
                onAccept={() =>
                  pendingProposal && void handleRespond(pendingProposal.proposal_id, true)
                }
                onRefuse={() =>
                  pendingProposal && void handleRespond(pendingProposal.proposal_id, false)
                }
                onAdvanced={refresh}
                onGoToCourses={() => setTab("courses")}
                onOpenNotifications={() => setTab("notifications")}
                onOpenGains={() => setTab("gains")}
              />
            )}
            {tab === "courses" && (
              <CoursesTab
                loading={loading}
                activeDelivery={activeDelivery}
                pendingProposal={pendingProposal}
                respondingTo={respondingTo}
                onAccept={() =>
                  pendingProposal && void handleRespond(pendingProposal.proposal_id, true)
                }
                onRefuse={() =>
                  pendingProposal && void handleRespond(pendingProposal.proposal_id, false)
                }
                onAdvanced={refresh}
                recentOrders={recentOrders}
                ordersLoading={ordersLoading}
                isSaoviaAgent={driver.is_saovia_agent}
                saoviaMissions={saoviaMissions}
                saoviaMissionsLoading={saoviaMissionsLoading}
                onRefreshSaoviaMissions={() => void loadSaoviaMissions()}
              />
            )}
            {tab === "messages" && <MessagesTab />}
            {tab === "gains" && (
              <GainsTab
                stats={stats}
                recentOrders={recentOrders}
                ordersLoading={ordersLoading}
                onBack={() => setTab("accueil")}
              />
            )}
            {tab === "notifications" && <NotificationsTab onBack={() => setTab("accueil")} />}
            {tab === "readiness" && (
              <ReadinessTab available={available} stats={stats} onBack={() => setTab("profil")} />
            )}
            {tab === "profil" && (
              <ProfilTab
                driver={driver}
                stats={stats}
                onOpenReadiness={() => setTab("readiness")}
              />
            )}
          </>
        )}
      </div>
      {showBottomNav && <DriverBottomNav active={tab} onChange={setTab} />}
    </main>
  );
}

function AccueilTab({
  driver,
  available,
  togglingAvailability,
  onToggleAvailability,
  livePosition,
  stats,
  statsLoading,
  loading,
  activeDelivery,
  pendingProposal,
  respondingTo,
  onAccept,
  onRefuse,
  onAdvanced,
  onGoToCourses,
  onOpenNotifications,
  onOpenGains,
}: {
  driver: Parameters<typeof DriverHeader>[0]["driver"];
  available: boolean;
  togglingAvailability: boolean;
  onToggleAvailability: () => void;
  livePosition: { lat: number; lng: number } | null;
  stats: DriverStatsData | null;
  statsLoading: boolean;
  loading: boolean;
  activeDelivery: Parameters<typeof ActiveDeliveryCard>[0]["activeDelivery"] | null;
  pendingProposal: Parameters<typeof ProposalAlertCard>[0]["proposal"] | null;
  respondingTo: string | null;
  onAccept: () => void;
  onRefuse: () => void;
  onAdvanced: () => void | Promise<void>;
  onGoToCourses: () => void;
  onOpenNotifications: () => void;
  onOpenGains: () => void;
}) {
  return (
    <>
      <DriverHeader
        driver={driver}
        available={available}
        togglingAvailability={togglingAvailability}
        onToggleAvailability={onToggleAvailability}
        onOpenNotifications={onOpenNotifications}
        onOpenGains={onOpenGains}
      />

      <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {livePosition ? (
          <div className="h-40 w-full">
            <DriverTrackingMap
              driverPosition={livePosition}
              restaurantPosition={null}
              showRestaurantAsDestination={false}
            />
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-1 bg-secondary text-center">
            <p className="text-sm font-medium text-muted-foreground">Carte indisponible</p>
            <p className="text-xs text-muted-foreground/70">
              Autorisez la géolocalisation pour voir votre position.
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Votre activité</h2>
          <button
            type="button"
            onClick={onOpenGains}
            className="text-xs font-semibold text-primary"
          >
            Voir mes gains ›
          </button>
        </div>
        <DriverStats data={stats} loading={statsLoading} />
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Courses disponibles</h2>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-3xl" />
        ) : activeDelivery ? (
          <ActiveDeliveryCard activeDelivery={activeDelivery} onAdvanced={onAdvanced} />
        ) : pendingProposal ? (
          <ProposalAlertCard
            proposal={pendingProposal}
            busy={respondingTo === pendingProposal.proposal_id}
            onAccept={onAccept}
            onRefuse={onRefuse}
          />
        ) : (
          <EmptyCoursesState available={available} onRefreshTab={onGoToCourses} />
        )}
      </div>

      <ZonesOpportunitiesCard />
    </>
  );
}

function CoursesTab({
  loading,
  activeDelivery,
  pendingProposal,
  respondingTo,
  onAccept,
  onRefuse,
  onAdvanced,
  recentOrders,
  ordersLoading,
  isSaoviaAgent,
  saoviaMissions,
  saoviaMissionsLoading,
  onRefreshSaoviaMissions,
}: {
  loading: boolean;
  activeDelivery: Parameters<typeof ActiveDeliveryCard>[0]["activeDelivery"] | null;
  pendingProposal: Parameters<typeof ProposalAlertCard>[0]["proposal"] | null;
  respondingTo: string | null;
  onAccept: () => void;
  onRefuse: () => void;
  onAdvanced: () => void | Promise<void>;
  recentOrders: DriverOrderHistoryEntry[];
  ordersLoading: boolean;
  isSaoviaAgent: boolean;
  saoviaMissions: AgentAssignedDelivery[];
  saoviaMissionsLoading: boolean;
  onRefreshSaoviaMissions: () => void | Promise<void>;
}) {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Mes courses</h1>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-3xl" />
      ) : activeDelivery ? (
        <ActiveDeliveryCard activeDelivery={activeDelivery} onAdvanced={onAdvanced} />
      ) : pendingProposal ? (
        <ProposalAlertCard
          proposal={pendingProposal}
          busy={respondingTo === pendingProposal.proposal_id}
          onAccept={onAccept}
          onRefuse={onRefuse}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
          Aucune course en cours.
        </div>
      )}

      {isSaoviaAgent && (
        <div>
          <h2 className="mb-3 mt-2 font-display text-base font-semibold">Missions SAOVIA</h2>
          {saoviaMissionsLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : saoviaMissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card py-8 text-center text-sm text-muted-foreground">
              Aucune mission affectée pour le moment.
            </div>
          ) : (
            <ul className="space-y-2">
              {saoviaMissions.map((m) => (
                <SaoviaMissionCard
                  key={m.assignment_id}
                  mission={m}
                  onChanged={onRefreshSaoviaMissions}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 mt-2 font-display text-base font-semibold">Historique</h2>
        {ordersLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-8 text-center text-sm text-muted-foreground">
            Aucune course pour le moment.
          </div>
        ) : (
          <ul className="space-y-2">
            {recentOrders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between rounded-2xl bg-card p-3.5 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold">Commande #{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">{order.restaurant_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {order.total_amount.toLocaleString("fr-FR")} {order.currency}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function GainsTab({
  stats,
  recentOrders,
  ordersLoading,
  onBack,
}: {
  stats: DriverStatsData | null;
  recentOrders: DriverOrderHistoryEntry[];
  ordersLoading: boolean;
  onBack: () => void;
}) {
  const deliveredOrders = recentOrders.filter((o) => o.status === "delivered");

  return (
    <>
      <SecondaryScreenHeader title="Mes gains" onBack={onBack} />

      <div className="rounded-3xl bg-primary p-5 text-center text-primary-foreground shadow-sm">
        <p className="text-xs opacity-90">Solde disponible</p>
        <p className="mt-1 font-display text-3xl font-bold">--</p>
        <p className="mt-2 text-[0.7rem] opacity-80">
          Le suivi détaillé des gains n'est pas encore disponible
          {stats ? ` -- ${stats.coursesCompletedToday} course(s) terminée(s) aujourd'hui.` : "."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <EarningsCard label="Aujourd'hui" amount={null} />
        <EarningsCard label="Cette semaine" amount={null} />
        <EarningsCard label="Ce mois" amount={null} />
      </div>

      <div>
        <h2 className="mb-3 font-display text-base font-semibold">Historique</h2>
        {ordersLoading ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : deliveredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-8 text-center text-sm text-muted-foreground">
            Aucune course terminée pour le moment.
          </div>
        ) : (
          <ul className="space-y-2">
            {deliveredOrders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between rounded-2xl bg-card p-3.5 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold">Commande #{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.delivered_at
                      ? new Date(order.delivered_at).toLocaleDateString("fr-FR")
                      : new Date(order.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <p className="text-sm font-semibold">--</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ProfilTab({
  driver,
  stats,
  onOpenReadiness,
}: {
  driver: Parameters<typeof DriverProfileCard>[0]["driver"];
  stats: DriverStatsData | null;
  onOpenReadiness: () => void;
}) {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Mon profil</h1>
      <DriverProfileCard driver={driver} />

      <button
        type="button"
        onClick={onOpenReadiness}
        className="flex w-full items-center justify-between rounded-2xl bg-card p-4 text-left shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold">Avant de commencer</p>
        </div>
        <span className="text-muted-foreground">›</span>
      </button>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">Mon véhicule</h2>
        <VehicleCard />
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">Activité</h2>
        <DriverStats data={stats} loading={!stats} />
      </section>

      <section className="space-y-2">
        <h2 className="mb-1 font-display text-base font-semibold">Paramètres</h2>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
          <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm">Confidentialité et sécurité</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
          <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm">Aide et support</p>
        </div>
      </section>

      <Button
        variant="outline"
        className="w-full border-destructive text-destructive hover:bg-destructive/10"
        onClick={() => void supabase.auth.signOut()}
      >
        <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
      </Button>
    </>
  );
}

function EmptyCoursesState({
  available,
  onRefreshTab,
}: {
  available: boolean;
  onRefreshTab: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-card py-14 text-center">
      <p className="text-sm text-muted-foreground">
        {available
          ? "En attente d'une nouvelle livraison..."
          : "Passez disponible pour recevoir des livraisons."}
      </p>
      <Button variant="ghost" size="sm" onClick={onRefreshTab} className="mt-2">
        Voir mes courses
      </Button>
    </div>
  );
}
