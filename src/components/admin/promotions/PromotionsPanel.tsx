import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import type { DbMenuItem } from "@/lib/menu-db";
import { currencySymbol, formatMoney } from "@/lib/currency";
import {
  createPromotion,
  deletePromotion,
  fetchPromotions,
  getDisplayStatus,
  isDuplicateActivePromotionError,
  setPromotionStatus,
  updatePromotion,
  type Promotion,
  type PromotionInput,
  type PromotionStatus,
  type PromotionType,
} from "@/lib/promotions";

function typeLabel(type: PromotionType, currency: string): string {
  switch (type) {
    case "fixed_amount":
      return `Réduction en ${currencySymbol(currency)}`;
    case "percentage":
      return "Réduction en %";
    case "free_delivery":
      return "Livraison gratuite";
  }
}

const STATUS_META: Record<PromotionStatus, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  active: { label: "Active", className: "bg-primary text-primary-foreground" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
  expired: { label: "Expirée", className: "bg-destructive/10 text-destructive" },
};

const TITLE_SUGGESTIONS = ["Offre du jour", "Promo week-end", "Super réduction", "Bon plan"];

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}

function emptyForm(products: DbMenuItem[]): PromotionInput {
  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    product_id: products[0]?.id ?? "",
    title: "",
    type: "fixed_amount",
    value: null,
    starts_at: now.toISOString(),
    ends_at: later.toISOString(),
  };
}

export function PromotionsPanel({
  restaurantId,
  currency,
  products,
  refreshSignal,
}: {
  restaurantId: string;
  currency: string;
  products: DbMenuItem[];
  /** Bump this from a parent (e.g. after the item editor's quick promotion toggle writes to the same table) to refetch without an extra prop-drilled callback. */
  refreshSignal?: number;
}) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionInput>(() => emptyForm(products));
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  async function refresh() {
    setLoading(true);
    try {
      setPromotions(await fetchPromotions(restaurantId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les promotions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, refreshSignal]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(products));
    setDialogOpen(true);
  }

  function openEdit(promo: Promotion) {
    setEditing(promo);
    setForm({ product_id: promo.product_id, title: promo.title, type: promo.type, value: promo.value, starts_at: promo.starts_at, ends_at: promo.ends_at });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.product_id) {
      toast.error("Sélectionnez un plat.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Le titre est requis.");
      return;
    }
    if (form.type !== "free_delivery" && (form.value === null || form.value <= 0)) {
      toast.error("Indiquez une valeur de réduction.");
      return;
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast.error("La date de fin doit être après la date de début.");
      return;
    }
    const product = productsById.get(form.product_id);
    if (form.type === "fixed_amount" && product?.price != null && (form.value ?? 0) >= product.price) {
      toast.error("La réduction doit être inférieure au prix du plat.");
      return;
    }

    setBusy(true);
    try {
      const payload: PromotionInput = { ...form, value: form.type === "free_delivery" ? null : form.value };
      if (editing) await updatePromotion(editing.id, payload);
      else await createPromotion(restaurantId, payload);
      toast.success(editing ? "Promotion mise à jour" : "Promotion créée");
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la promotion.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(promo: Promotion, next: "active" | "inactive") {
    setBusy(true);
    try {
      await setPromotionStatus(promo.id, next);
      toast.success(next === "active" ? "Promotion activée" : "Promotion désactivée");
      await refresh();
    } catch (err) {
      if (isDuplicateActivePromotionError(err)) toast.error("Ce plat a déjà une promotion active. Désactivez-la d'abord.");
      else toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour la promotion.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deletePromotion(deleteTarget.id);
      toast.success("Promotion supprimée");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer la promotion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Promotions</h2>
          <p className="text-sm text-muted-foreground">Créez des offres sur vos plats — visibles côté client uniquement pendant qu'elles sont actives.</p>
        </div>
        <Button onClick={openCreate} disabled={products.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle promotion
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Ajoutez d'abord un plat dans l'onglet Carte pour pouvoir créer une promotion.</Card>
      ) : loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Chargement...</Card>
      ) : promotions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Aucune promotion pour le moment.</Card>
      ) : (
        <div className="space-y-3">
          {promotions.map((promo) => {
            const product = productsById.get(promo.product_id);
            const displayStatus = getDisplayStatus(promo);
            const meta = STATUS_META[displayStatus];
            return (
              <Card key={promo.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{promo.title}</p>
                    <Badge className={meta.className}>{meta.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {product?.name ?? "Plat introuvable"} · {typeLabel(promo.type, currency)}
                    {promo.type === "percentage"
                      ? ` (-${promo.value}%)`
                      : promo.type === "fixed_amount" && promo.value !== null
                        ? ` (-${formatMoney(promo.value, currency)})`
                        : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Du {new Date(promo.starts_at).toLocaleString("fr-FR")} au {new Date(promo.ends_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={promo.status === "active"}
                    disabled={busy}
                    aria-label={promo.status === "active" ? "Désactiver la promotion" : "Activer la promotion"}
                    onCheckedChange={(checked) => void toggleStatus(promo, checked ? "active" : "inactive")}
                  />
                  <Button variant="outline" size="icon" onClick={() => openEdit(promo)} aria-label="Modifier">
                    <PencilLine className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setDeleteTarget(promo)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la promotion" : "Nouvelle promotion"}</DialogTitle>
            <DialogDescription>Visible côté client uniquement une fois activée et pendant sa période de validité.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plat</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm((c) => ({ ...c, product_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un plat" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.price != null ? ` — ${formatMoney(p.price, currency)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                placeholder={TITLE_SUGGESTIONS[0]}
                list="promotion-title-suggestions"
              />
              <datalist id="promotion-title-suggestions">
                {TITLE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Type de promotion</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((c) => ({ ...c, type: v as PromotionType, value: v === "free_delivery" ? null : c.value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_amount">
                    Réduction en {currencySymbol(currency)} (ex: -500 {currencySymbol(currency)})
                  </SelectItem>
                  <SelectItem value="percentage">Réduction en % (ex: -20%)</SelectItem>
                  <SelectItem value="free_delivery">Livraison gratuite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type !== "free_delivery" && (
              <div className="space-y-1.5">
                <Label>
                  {form.type === "percentage" ? "Pourcentage de réduction" : `Montant de la réduction (${currencySymbol(currency)})`}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={form.type === "percentage" ? 99 : undefined}
                  value={form.value ?? ""}
                  onChange={(e) => setForm((c) => ({ ...c, value: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInputValue(form.starts_at)}
                  onChange={(e) => setForm((c) => ({ ...c, starts_at: fromLocalInputValue(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInputValue(form.ends_at)}
                  onChange={(e) => setForm((c) => ({ ...c, ends_at: fromLocalInputValue(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette promotion ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est définitive. « {deleteTarget?.title} » ne sera plus visible côté client.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
