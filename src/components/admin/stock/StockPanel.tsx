import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, PackageX, PackageCheck, Send } from "lucide-react";
import { StatCard } from "@/components/admin/stats/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import type { DbCategory, DbMenuItem } from "@/lib/menu-db";
import {
  computeStockStatus,
  fetchInventoryForRestaurant,
  fetchMovements,
  fetchStockOverview,
  recordInventoryMovement,
  setInventoryAlertThreshold,
  setInventoryTracking,
  MOVEMENT_TYPE_LABELS,
  STOCK_STATUS_LABELS,
  type InventoryRecord,
  type MovementFilters,
  type MovementRecord,
  type MovementType,
  type StockOverview,
  type StockStatus,
} from "@/lib/inventory";

const STATUS_BADGE_CLASS: Record<StockStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  low: "bg-amber-100 text-amber-700",
  out_of_stock: "bg-destructive/10 text-destructive",
  not_tracked: "bg-slate-100 text-slate-500",
};

const REASON_PRESETS = [
  "Livraison fournisseur",
  "Casse / Perte",
  "Erreur d'inventaire",
  "Retour client",
  "Comptage physique",
  "Autre",
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MovementQuantityCell({ movement }: { movement: MovementRecord }) {
  const sign = movement.movement_type === "OUT" ? -1 : movement.movement_type === "IN" ? 1 : Math.sign(movement.quantity) || 1;
  const magnitude = movement.movement_type === "ADJUSTMENT" ? Math.abs(movement.quantity) : movement.quantity;
  const positive = sign >= 0;
  return (
    <span className={positive ? "font-medium text-emerald-600" : "font-medium text-destructive"}>
      {positive ? "+" : "-"}
      {magnitude}
    </span>
  );
}

function reasonLabel(reason: string | null): string {
  switch (reason) {
    case "order_confirmed":
      return "Commande confirmée";
    case "order_cancelled":
      return "Commande annulée";
    case "initial_stock":
      return "Stock initial";
    default:
      return reason ?? "—";
  }
}

export function StockPanel({
  restaurantId,
  products,
  categories,
  canManage,
  onChanged,
}: {
  restaurantId: string;
  products: DbMenuItem[];
  categories: DbCategory[];
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [subTab, setSubTab] = useState<"vue" | "mouvements">("vue");
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [overview, setOverview] = useState<StockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterType, setFilterType] = useState<MovementType | "all">("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [movementDialog, setMovementDialog] = useState<{ mode: MovementType; product: DbMenuItem } | null>(null);
  const [movementValue, setMovementValue] = useState("");
  const [movementReason, setMovementReason] = useState(REASON_PRESETS[0]!);
  const [movementCustomReason, setMovementCustomReason] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [confirmMovement, setConfirmMovement] = useState<{
    mode: MovementType;
    product: DbMenuItem;
    value: number;
    reason: string;
    note: string | null;
    resultingQuantity: number;
  } | null>(null);

  const [thresholdDialogProduct, setThresholdDialogProduct] = useState<DbMenuItem | null>(null);
  const [thresholdValue, setThresholdValue] = useState("0");

  const inventoryByProduct = useMemo(() => {
    const map = new Map<string, InventoryRecord>();
    for (const row of inventory) map.set(row.product_id, row);
    return map;
  }, [inventory]);

  const categoryLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.label);
    return map;
  }, [categories]);

  async function refreshOverview() {
    setLoading(true);
    try {
      const [inv, ov] = await Promise.all([fetchInventoryForRestaurant(restaurantId), fetchStockOverview(restaurantId)]);
      setInventory(inv);
      setOverview(ov);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger le stock.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshMovements() {
    setMovementsLoading(true);
    try {
      const filters: MovementFilters = {};
      if (filterProductId !== "all") filters.productId = filterProductId;
      if (filterType !== "all") filters.movementType = filterType;
      if (filterFrom) filters.from = new Date(filterFrom).toISOString();
      if (filterTo) filters.to = new Date(filterTo + "T23:59:59").toISOString();
      const rows = await fetchMovements(restaurantId, filters);
      setMovements(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger l'historique.");
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => {
    void refreshOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    if (subTab === "mouvements") void refreshMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, restaurantId, filterProductId, filterType, filterFrom, filterTo]);

  const knownUsers = useMemo(() => {
    const names = new Set<string>();
    for (const m of movements) if (m.created_by_name) names.add(m.created_by_name);
    return Array.from(names).sort();
  }, [movements]);

  const filteredMovements = useMemo(() => {
    if (filterUser === "all") return movements;
    return movements.filter((m) => m.created_by_name === filterUser);
  }, [movements, filterUser]);

  function openMovementDialog(mode: MovementType, product: DbMenuItem) {
    setMovementDialog({ mode, product });
    setMovementValue("");
    setMovementReason(REASON_PRESETS[0]!);
    setMovementCustomReason("");
    setMovementNote("");
  }

  async function handleActivateTracking(product: DbMenuItem) {
    setBusy(true);
    try {
      await setInventoryTracking({ restaurantId, productId: product.id, enabled: true });
      toast.success(`Suivi du stock activé pour ${product.name}`);
      await refreshOverview();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'activer le suivi.");
    } finally {
      setBusy(false);
    }
  }

  function submitMovementForm() {
    if (!movementDialog) return;
    const value = Number(movementValue);
    if (!Number.isFinite(value) || (movementDialog.mode !== "ADJUSTMENT" && value <= 0)) {
      toast.error("Indiquez une quantité valide.");
      return;
    }
    if (movementDialog.mode === "ADJUSTMENT" && value < 0) {
      toast.error("Le stock ne peut pas être négatif.");
      return;
    }
    const reason = movementReason === "Autre" ? movementCustomReason.trim() : movementReason;
    if (!reason) {
      toast.error("Indiquez un motif.");
      return;
    }
    const current = inventoryByProduct.get(movementDialog.product.id);
    const currentQty = current?.quantity ?? 0;
    const resultingQuantity =
      movementDialog.mode === "IN" ? currentQty + value : movementDialog.mode === "OUT" ? currentQty - value : value;

    if (movementDialog.mode === "OUT" && resultingQuantity < 0) {
      toast.error(`Stock insuffisant (disponible : ${currentQty}).`);
      return;
    }

    setConfirmMovement({
      mode: movementDialog.mode,
      product: movementDialog.product,
      value,
      reason,
      note: movementNote.trim() || null,
      resultingQuantity,
    });
  }

  async function executeConfirmedMovement() {
    if (!confirmMovement) return;
    setBusy(true);
    try {
      await recordInventoryMovement({
        restaurantId,
        productId: confirmMovement.product.id,
        movementType: confirmMovement.mode,
        value: confirmMovement.value,
        reason: confirmMovement.reason,
        note: confirmMovement.note,
      });
      toast.success("Mouvement enregistré");
      setConfirmMovement(null);
      setMovementDialog(null);
      await refreshOverview();
      if (subTab === "mouvements") await refreshMovements();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer ce mouvement.");
    } finally {
      setBusy(false);
    }
  }

  function openThresholdDialog(product: DbMenuItem) {
    const inv = inventoryByProduct.get(product.id);
    setThresholdValue(String(inv?.alert_threshold ?? 0));
    setThresholdDialogProduct(product);
  }

  async function saveThreshold() {
    if (!thresholdDialogProduct) return;
    const value = Math.max(0, Number(thresholdValue) || 0);
    setBusy(true);
    try {
      await setInventoryAlertThreshold({ restaurantId, productId: thresholdDialogProduct.id, alertThreshold: value });
      toast.success("Seuil d'alerte mis à jour");
      setThresholdDialogProduct(null);
      await refreshOverview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour le seuil.");
    } finally {
      setBusy(false);
    }
  }

  const isDecrease = confirmMovement
    ? confirmMovement.mode === "OUT" || (confirmMovement.mode === "ADJUSTMENT" && confirmMovement.resultingQuantity < (inventoryByProduct.get(confirmMovement.product.id)?.quantity ?? 0))
    : false;

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-border bg-muted p-1">
        <button
          type="button"
          onClick={() => setSubTab("vue")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${subTab === "vue" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          Vue d'ensemble
        </button>
        <button
          type="button"
          onClick={() => setSubTab("mouvements")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${subTab === "mouvements" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          Mouvements
        </button>
      </div>

      {subTab === "vue" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={PackageCheck} label="Produits suivis" value={String(overview?.trackedCount ?? 0)} />
            <StatCard icon={AlertTriangle} label="Stock faible" value={String(overview?.lowStockCount ?? 0)} />
            <StatCard icon={PackageX} label="Épuisés" value={String(overview?.outOfStockCount ?? 0)} />
            <StatCard icon={Send} label="Mouvements aujourd'hui" value={String(overview?.movementsToday ?? 0)} />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-12 text-center text-sm text-muted-foreground">
              Aucun produit pour ce restaurant pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Produit</th>
                    <th className="px-4 py-3">Catégorie</th>
                    <th className="px-4 py-3">Stock actuel</th>
                    <th className="px-4 py-3">Seuil d'alerte</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Dernière modification</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product) => {
                    const inv = inventoryByProduct.get(product.id);
                    const status = computeStockStatus(inv);
                    return (
                      <tr key={product.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{product.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {product.category_id ? categoryLabelById.get(product.category_id) ?? "—" : "—"}
                        </td>
                        <td className="px-4 py-3">{inv ? inv.quantity : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{inv ? inv.alert_threshold : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge className={STATUS_BADGE_CLASS[status]}>{STOCK_STATUS_LABELS[status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{inv ? formatDateTime(inv.updated_at) : "—"}</td>
                        <td className="px-4 py-3">
                          {!canManage ? null : !inv || !inv.tracking_enabled ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleActivateTracking(product)}>
                              Activer le suivi
                            </Button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => openMovementDialog("IN", product)}>
                                Ajouter
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openMovementDialog("OUT", product)}>
                                Retirer
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openMovementDialog("ADJUSTMENT", product)}>
                                Ajuster
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openThresholdDialog(product)}>
                                Seuil
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Produit</Label>
              <Select value={filterProductId} onValueChange={setFilterProductId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les produits</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as MovementType | "all")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {(Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {MOVEMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Utilisateur</Label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {knownUsers.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Du</Label>
                <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Au</Label>
                <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-9" />
              </div>
            </div>
          </div>

          {movementsLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : filteredMovements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-12 text-center text-sm text-muted-foreground">
              Aucun mouvement pour ce filtre.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Produit</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Quantité</th>
                    <th className="px-4 py-3">Motif</th>
                    <th className="px-4 py-3">Utilisateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMovements.map((m) => {
                    const product = products.find((p) => p.id === m.product_id);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(m.created_at)}</td>
                        <td className="px-4 py-3 font-medium">{product?.name ?? "Produit supprimé"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{MOVEMENT_TYPE_LABELS[m.movement_type]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <MovementQuantityCell movement={m} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {m.reason && !["order_confirmed", "order_cancelled", "initial_stock"].includes(m.reason)
                            ? m.reason
                            : reasonLabel(m.reason)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.created_by_name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(movementDialog)} onOpenChange={(open) => !open && setMovementDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movementDialog?.mode === "IN" ? "Ajouter du stock" : movementDialog?.mode === "OUT" ? "Retirer du stock" : "Ajuster le stock"}
            </DialogTitle>
            <DialogDescription>{movementDialog?.product.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{movementDialog?.mode === "ADJUSTMENT" ? "Nouvelle quantité" : "Quantité"}</Label>
              <Input type="number" min={0} value={movementValue} onChange={(e) => setMovementValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Select value={movementReason} onValueChange={setMovementReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASON_PRESETS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {movementReason === "Autre" && (
                <Input
                  className="mt-2"
                  placeholder="Précisez le motif"
                  value={movementCustomReason}
                  onChange={(e) => setMovementCustomReason(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Note (optionnel)</Label>
              <Textarea rows={2} value={movementNote} onChange={(e) => setMovementNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMovementDialog(null)} disabled={busy}>
              Annuler
            </Button>
            <Button type="button" onClick={submitMovementForm} disabled={busy}>
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmMovement)} onOpenChange={(open) => !open && setConfirmMovement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isDecrease ? "Confirmer cette sortie de stock ?" : "Confirmer ce mouvement ?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMovement?.product.name} : stock actuel{" "}
              {inventoryByProduct.get(confirmMovement?.product.id ?? "")?.quantity ?? 0} → nouveau stock{" "}
              {confirmMovement?.resultingQuantity}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeConfirmedMovement()} disabled={busy}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(thresholdDialogProduct)} onOpenChange={(open) => !open && setThresholdDialogProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le seuil d'alerte</DialogTitle>
            <DialogDescription>{thresholdDialogProduct?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Seuil d'alerte</Label>
            <Input type="number" min={0} value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setThresholdDialogProduct(null)} disabled={busy}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void saveThreshold()} disabled={busy}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
