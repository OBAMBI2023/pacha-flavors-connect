import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation, Package, Phone, Power, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { useDriverProposals } from "@/hooks/useDriverProposals";
import { useAudioUnlock } from "@/hooks/useAudioUnlock";
import { useDriverProposalAlert } from "@/hooks/useDriverProposalAlert";
import { respondToProposal, setDriverAvailability, updateDriverLocation } from "@/lib/delivery";
import { ProposalAlertCard } from "@/components/driver/ProposalAlertCard";
import { DeliveryStepTimeline } from "@/components/driver/DeliveryStepTimeline";
import { DeliveryActionButton } from "@/components/driver/DeliveryActionButton";
import { CashCollectionSheet } from "@/components/driver/CashCollectionSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TITLE = "Espace livreur | SAOVIA";
const LOCATION_PUSH_INTERVAL_ACTIVE_MS = 15_000;
const LOCATION_PUSH_INTERVAL_IDLE_MS = 45_000;

export const Route = createFileRoute("/livreur")({
  ssr: false,
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DriverPage,
});

function DriverPage() {
  const { session, loading: authLoading, driver } = useDriverAuth();

  if (authLoading) {
    return <CenteredMessage>Chargement...</CenteredMessage>;
  }
  if (!session) {
    return <DriverLoginForm />;
  }
  if (!driver) {
    return (
      <CenteredMessage>
        <p>Ce compte n&apos;est pas configuré comme livreur.</p>
        <Button variant="outline" className="mt-4" onClick={() => void supabase.auth.signOut()}>
          Se déconnecter
        </Button>
      </CenteredMessage>
    );
  }
  return <DriverDashboard driverId={driver.id} initiallyAvailable={driver.status === "available"} />;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 text-center text-sm text-muted-foreground">
      <div>{children}</div>
    </main>
  );
}

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
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">SAOVIA</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Espace livreur</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Se connecter
          </Button>
        </form>
        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
      </div>
    </main>
  );
}

function DriverDashboard({ driverId, initiallyAvailable }: { driverId: string; initiallyAvailable: boolean }) {
  const [available, setAvailable] = useState(initiallyAvailable);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [cashSheetOpen, setCashSheetOpen] = useState(false);
  const { pendingProposal, activeDelivery, loading, refresh } = useDriverProposals(driverId);

  useAudioUnlock();
  useDriverProposalAlert(pendingProposal);

  // Pushes a fresh position while the driver is available (dispatch needs
  // this to consider them for new proposals, well under the 5-minute
  // freshness window) OR while a delivery is actually active (tenant
  // tracking needs this). `trackingActive` -- not `available` alone -- is
  // the guard: if setDriverAvailability's own server-side no-op guard
  // (status must be 'available'/'offline') silently rejects a
  // "Passer hors ligne" click mid-delivery, `available` still flips
  // optimistically client-side, but `activeDelivery` keeps this running
  // regardless, so GPS never stops mid-delivery by accident. Cadence steps
  // up to ~15s once there's a real active delivery (tenant map wants
  // fresher updates than mere dispatch-eligibility needs); stopping at
  // delivered/cancelled falls out for free since get_driver_active_delivery
  // already excludes those statuses, so activeDelivery just becomes null.
  const trackingActive = available || Boolean(activeDelivery);
  const pushIntervalMs = activeDelivery ? LOCATION_PUSH_INTERVAL_ACTIVE_MS : LOCATION_PUSH_INTERVAL_IDLE_MS;

  useEffect(() => {
    if (!trackingActive) return;
    let cancelled = false;
    let warnedOnce = false;

    function pushLocation() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          void updateDriverLocation(driverId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
        },
        () => {
          if (!warnedOnce) {
            warnedOnce = true;
            toast.error("Position indisponible -- autorisez la géolocalisation pour recevoir des courses.");
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

  async function toggleAvailability() {
    const next = !available;
    // Contextual permission request -- exactly when the driver signals
    // intent to receive courses, never blindly on page load. Synchronous,
    // before the network call (not after an await), to stay inside the
    // user-activation window on stricter browsers (WebKit). Independent of
    // whether setDriverAvailability itself succeeds. `=== "default"` means
    // this never re-prompts once the browser has settled on granted/denied.
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
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

  return (
    <main className="min-h-screen bg-secondary/40 pb-16">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">SAOVIA</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">Espace livreur</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void supabase.auth.signOut()}>
            Déconnexion
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${available ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
            <span className="text-sm font-medium">{available ? "Disponible" : "Hors ligne"}</span>
          </div>
          <Button size="sm" variant={available ? "outline" : "default"} disabled={togglingAvailability} onClick={() => void toggleAvailability()}>
            <Power className="mr-2 h-4 w-4" />
            {available ? "Passer hors ligne" : "Devenir disponible"}
          </Button>
        </div>

        {loading ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">Chargement...</p>
        ) : activeDelivery ? (
          <div className="mt-6 space-y-4 rounded-2xl border border-primary/30 bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Livraison en cours</p>
            <p className="font-display text-xl font-semibold">Commande #{activeDelivery.order_number}</p>
            <p className="text-sm text-muted-foreground">{activeDelivery.restaurant_name}</p>
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <p className="font-medium">{activeDelivery.customer_name}</p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {activeDelivery.customer_phone}
              </p>
              {activeDelivery.delivery_address && (
                <p className="flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {activeDelivery.delivery_address}
                    {activeDelivery.delivery_commune ? ` · ${activeDelivery.delivery_commune}` : ""}
                  </span>
                </p>
              )}
            </div>
            {activeDelivery.items.length > 0 && (
              <ul className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                {activeDelivery.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 shrink-0" />
                    {item.quantity} × {item.product_name}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between border-t border-border pt-4 text-base font-semibold">
              <span>Montant à collecter</span>
              <span>
                {activeDelivery.total_amount.toLocaleString("fr-FR")} {activeDelivery.currency}
              </span>
            </div>
            <DeliveryStepTimeline
              status={activeDelivery.driver_delivery_status}
              isCashOrder={
                activeDelivery.payment_status === "cash_pending" ||
                activeDelivery.driver_delivery_status === "cash_collection" ||
                activeDelivery.driver_delivery_status === "payment_confirmed"
              }
            />
            <DeliveryActionButton activeDelivery={activeDelivery} onAdvanced={refresh} onOpenCashCollection={() => setCashSheetOpen(true)} />
            <CashCollectionSheet
              open={cashSheetOpen}
              onOpenChange={setCashSheetOpen}
              activeDelivery={activeDelivery}
              onConfirmed={refresh}
            />
          </div>
        ) : pendingProposal ? (
          <ProposalAlertCard
            proposal={pendingProposal}
            busy={respondingTo === pendingProposal.proposal_id}
            onAccept={() => void handleRespond(pendingProposal.proposal_id, true)}
            onRefuse={() => void handleRespond(pendingProposal.proposal_id, false)}
          />
        ) : (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
            <Navigation className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {available ? "En attente d'une nouvelle livraison..." : "Passez disponible pour recevoir des livraisons."}
            </p>
            <Button variant="ghost" size="sm" onClick={() => void refresh()} className="mt-2">
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Actualiser
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

