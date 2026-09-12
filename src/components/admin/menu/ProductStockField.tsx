import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  computeStockStatus,
  fetchInventoryForProduct,
  setInventoryAlertThreshold,
  setInventoryTracking,
  STOCK_STATUS_LABELS,
  type InventoryRecord,
} from "@/lib/inventory";

export function ProductStockField({
  restaurantId,
  productId,
  onTrackingChange,
  onChanged,
}: {
  restaurantId: string;
  productId: string | null;
  /** Lets the parent form know whether "Disponible" is now stock-controlled, so it can stop overwriting is_available on save. */
  onTrackingChange?: (enabled: boolean) => void;
  onChanged?: () => void;
}) {
  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [threshold, setThreshold] = useState("0");

  async function refresh() {
    if (!productId) return;
    setLoading(true);
    try {
      const row = await fetchInventoryForProduct(restaurantId, productId);
      setInventory(row);
      onTrackingChange?.(row?.tracking_enabled ?? false);
      if (row) setThreshold(String(row.alert_threshold));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger le stock de ce produit.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleEnable() {
    if (!productId) return;
    const qty = Math.max(0, Number(initialQuantity) || 0);
    const alert = Math.max(0, Number(threshold) || 0);
    setBusy(true);
    try {
      await setInventoryTracking({ restaurantId, productId, enabled: true, initialQuantity: qty, alertThreshold: alert });
      toast.success("Suivi du stock activé");
      await refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'activer le suivi du stock.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!productId) return;
    setBusy(true);
    try {
      await setInventoryTracking({ restaurantId, productId, enabled: false });
      toast.success("Suivi du stock désactivé");
      await refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de désactiver le suivi du stock.");
    } finally {
      setBusy(false);
    }
  }

  async function handleThresholdBlur() {
    if (!productId || !inventory) return;
    const next = Math.max(0, Number(threshold) || 0);
    if (next === inventory.alert_threshold) return;
    setBusy(true);
    try {
      await setInventoryAlertThreshold({ restaurantId, productId, alertThreshold: next });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour le seuil.");
    } finally {
      setBusy(false);
    }
  }

  if (!productId) {
    return (
      <div className="space-y-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Gestion du stock</p>
        <p>Enregistrez d'abord ce plat pour pouvoir activer le suivi du stock.</p>
      </div>
    );
  }

  const enabled = inventory?.tracking_enabled ?? false;
  const status = computeStockStatus(inventory);

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Gestion du stock</p>
          <p className="text-xs text-muted-foreground">
            Une fois activé, le plat passe automatiquement « Épuisé » quand le stock atteint zéro.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={busy || loading}
          onCheckedChange={(v) => void (v ? handleEnable() : handleDisable())}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : enabled && inventory ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Stock actuel</Label>
            <p className="mt-1 font-display text-xl font-semibold">{inventory.quantity}</p>
            <p className="text-xs text-muted-foreground">{STOCK_STATUS_LABELS[status]}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Seuil d'alerte</Label>
            <Input
              type="number"
              min={0}
              value={threshold}
              disabled={busy}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={() => void handleThresholdBlur()}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Pour ajouter, retirer ou ajuster le stock, utilisez l'onglet Stock.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Stock initial</Label>
            <Input type="number" min={0} value={initialQuantity} disabled={busy} onChange={(e) => setInitialQuantity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Seuil d'alerte</Label>
            <Input type="number" min={0} value={threshold} disabled={busy} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <Button type="button" size="sm" variant="outline" className="sm:col-span-2" disabled={busy} onClick={() => void handleEnable()}>
            Activer le suivi du stock
          </Button>
        </div>
      )}
    </div>
  );
}
