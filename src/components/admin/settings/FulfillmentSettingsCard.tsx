import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { countActiveOrdersByFulfillmentType, fetchFulfillmentModes, updateFulfillmentModes, type FulfillmentModes } from "@/lib/restaurantSettings";

const MODE_META = {
  delivery: { key: "delivery_enabled" as const, icon: Truck, title: "Livraison", description: "Les clients peuvent se faire livrer leur commande." },
  pickup: { key: "pickup_enabled" as const, icon: ShoppingBag, title: "Retrait sur place", description: "Les clients peuvent venir récupérer leur commande au restaurant." },
} satisfies Record<string, { key: keyof FulfillmentModes; icon: typeof Truck; title: string; description: string }>;

/**
 * Disabling either switch never touches an order already placed with that
 * fulfillment_type -- it only stops the mode from being offered at checkout
 * going forward. create_order re-validates fulfillment_type against these
 * same flags server-side regardless of what this panel shows.
 */
export function FulfillmentSettingsCard({ restaurantId }: { restaurantId: string }) {
  const [modes, setModes] = useState<FulfillmentModes | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ mode: "delivery" | "pickup"; activeOrders: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFulfillmentModes(restaurantId)
      .then((m) => { if (!cancelled) setModes(m); })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de charger les paramètres."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [restaurantId]);

  async function applyChange(mode: "delivery" | "pickup", enabled: boolean) {
    if (!modes) return;
    const key = MODE_META[mode].key;
    const next = { ...modes, [key]: enabled };
    if (!next.delivery_enabled && !next.pickup_enabled) {
      toast.error("Au moins un mode de réception doit rester actif.");
      return;
    }
    setBusy(true);
    try {
      await updateFulfillmentModes(restaurantId, next);
      setModes(next);
      toast.success("Paramètres mis à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour les paramètres.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(mode: "delivery" | "pickup", enabled: boolean) {
    if (enabled) {
      await applyChange(mode, true);
      return;
    }
    // Disabling -- confirm first, and tell the tenant how many active
    // orders currently use this mode (informational, never blocking).
    setBusy(true);
    try {
      const activeOrders = await countActiveOrdersByFulfillmentType(restaurantId, mode);
      setConfirmTarget({ mode, activeOrders });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de vérifier les commandes en cours.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    if (!confirmTarget) return;
    const { mode } = confirmTarget;
    setConfirmTarget(null);
    await applyChange(mode, false);
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-xl font-semibold">Modes de réception des commandes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choisissez les modes proposés à vos clients au moment de la commande.</p>

      {loading || !modes ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {(Object.keys(MODE_META) as Array<"delivery" | "pickup">).map((mode) => {
            const meta = MODE_META[mode];
            const Icon = meta.icon;
            const checked = modes[meta.key];
            return (
              <div key={mode} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{meta.title}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <Switch checked={checked} disabled={busy} onCheckedChange={(v) => void handleToggle(mode, v)} />
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(confirmTarget)} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver « {confirmTarget ? MODE_META[confirmTarget.mode].title : ""} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget && confirmTarget.activeOrders > 0
                ? `${confirmTarget.activeOrders} commande(s) en cours utilisent déjà ce mode -- elles ne seront pas affectées, mais vos clients ne pourront plus choisir ce mode pour leurs prochaines commandes.`
                : "Vos clients ne pourront plus choisir ce mode pour leurs prochaines commandes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDisable()} disabled={busy}>Désactiver</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
