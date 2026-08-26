import { useEffect, useState } from "react";
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
import { CustomerMultiSelect } from "@/components/admin/promotions/CustomerMultiSelect";
import type { Customer } from "@/lib/customers-db";
import type { PromotionType } from "@/lib/promotions";
import { currencySymbol, formatMoney } from "@/lib/currency";
import {
  createPromoCode,
  deletePromoCode,
  fetchPromoCodeTargets,
  fetchPromoCodes,
  isDuplicateCodeError,
  replacePromoCodeTargets,
  setPromoCodeActive,
  updatePromoCode,
  type PromoCode,
  type PromoCodeInput,
  type PromoVisibility,
} from "@/lib/promoCodes";

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

const VISIBILITY_LABELS: Record<PromoVisibility, string> = {
  public: "Tous les clients",
  targeted: "Clients sélectionnés",
  personal: "Client spécifique",
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}

function emptyForm(): PromoCodeInput {
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    name: "",
    code: "",
    discount_type: "fixed_amount",
    discount_value: null,
    visibility: "public",
    max_total_uses: null,
    max_uses_per_customer: 1,
    starts_at: now.toISOString(),
    ends_at: later.toISOString(),
    is_active: true,
  };
}

export function PromoCodesPanel({
  restaurantId,
  currency,
  refreshSignal,
}: {
  restaurantId: string;
  currency: string;
  refreshSignal?: number;
}) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<PromoCodeInput>(() => emptyForm());
  const [targets, setTargets] = useState<Customer[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setPromoCodes(await fetchPromoCodes(restaurantId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les codes promo.");
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
    setForm(emptyForm());
    setTargets([]);
    setDialogOpen(true);
  }

  async function openEdit(promo: PromoCode) {
    setEditing(promo);
    setForm({
      name: promo.name,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      visibility: promo.visibility,
      max_total_uses: promo.max_total_uses,
      max_uses_per_customer: promo.max_uses_per_customer,
      starts_at: promo.starts_at,
      ends_at: promo.ends_at,
      is_active: promo.is_active,
    });
    setTargets([]);
    setDialogOpen(true);
    if (promo.visibility !== "public") {
      try {
        setTargets((await fetchPromoCodeTargets(promo.id)).map((t) => t.customer));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Impossible de charger les clients ciblés.");
      }
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Le nom est requis.");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Le code promo est requis.");
      return;
    }
    if (form.discount_type !== "free_delivery" && (form.discount_value === null || form.discount_value <= 0)) {
      toast.error("Indiquez une valeur de réduction.");
      return;
    }
    if (form.discount_type === "percentage" && (form.discount_value ?? 0) >= 100) {
      toast.error("Le pourcentage doit être inférieur à 100.");
      return;
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast.error("La date de fin doit être après la date de début.");
      return;
    }
    if (form.max_total_uses !== null && form.max_total_uses <= 0) {
      toast.error("La limite globale doit être un nombre positif (ou vide pour illimité).");
      return;
    }
    if (form.max_uses_per_customer <= 0) {
      toast.error("La limite par client doit être un nombre positif.");
      return;
    }
    if (form.visibility !== "public" && targets.length === 0) {
      toast.error("Sélectionnez au moins un client pour ce ciblage.");
      return;
    }
    if (form.visibility === "personal" && targets.length > 1) {
      toast.error("Une promotion personnelle ne peut cibler qu'un seul client.");
      return;
    }

    setBusy(true);
    try {
      const payload: PromoCodeInput = { ...form, discount_value: form.discount_type === "free_delivery" ? null : form.discount_value };
      const promoCodeId = editing ? editing.id : await createPromoCode(restaurantId, payload);
      if (editing) await updatePromoCode(editing.id, payload);
      await replacePromoCodeTargets(promoCodeId, form.visibility === "public" ? [] : targets.map((c) => c.id));
      toast.success(editing ? "Code promo mis à jour" : "Code promo créé");
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      if (isDuplicateCodeError(err)) toast.error("Ce code existe déjà pour ce restaurant.");
      else toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer le code promo.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(promo: PromoCode, next: boolean) {
    setBusy(true);
    try {
      await setPromoCodeActive(promo.id, next);
      toast.success(next ? "Code promo activé" : "Code promo désactivé");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour le code promo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deletePromoCode(deleteTarget.id);
      toast.success("Code promo supprimé");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer le code promo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Codes promo</h2>
          <p className="text-sm text-muted-foreground">
            Créez des codes que vos clients saisissent au moment de commander — publics, réservés à des clients sélectionnés, ou personnels.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau code promo
        </Button>
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Chargement...</Card>
      ) : promoCodes.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Aucun code promo pour le moment.</Card>
      ) : (
        <div className="space-y-3">
          {promoCodes.map((promo) => {
            const expired = new Date(promo.ends_at).getTime() < Date.now();
            return (
              <Card key={promo.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{promo.name}</p>
                    <Badge variant="outline" className="font-mono">
                      {promo.code}
                    </Badge>
                    <Badge className={promo.is_active && !expired ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>
                      {expired ? "Expiré" : promo.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {VISIBILITY_LABELS[promo.visibility]} · {typeLabel(promo.discount_type, currency)}
                    {promo.discount_type === "percentage"
                      ? ` (-${promo.discount_value}%)`
                      : promo.discount_type === "fixed_amount" && promo.discount_value !== null
                        ? ` (-${formatMoney(promo.discount_value, currency)})`
                        : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Du {new Date(promo.starts_at).toLocaleString("fr-FR")} au {new Date(promo.ends_at).toLocaleString("fr-FR")} · Limite globale{" "}
                    {promo.max_total_uses ?? "illimitée"} · Limite par client {promo.max_uses_per_customer}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={promo.is_active}
                    disabled={busy}
                    aria-label={promo.is_active ? "Désactiver le code promo" : "Activer le code promo"}
                    onCheckedChange={(checked) => void toggleActive(promo, checked)}
                  />
                  <Button variant="outline" size="icon" onClick={() => void openEdit(promo)} aria-label="Modifier">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le code promo" : "Nouveau code promo"}</DialogTitle>
            <DialogDescription>Le client saisit ce code au Checkout ; la réduction est toujours revérifiée côté serveur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nom (interne)</Label>
                <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Ex. Promo rentrée" />
              </div>
              <div className="space-y-1.5">
                <Label>Code promo</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))}
                  placeholder="Ex. BIENVENUE10"
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">Sera normalisé en majuscules, sans espaces.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Type de promotion</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v) => setForm((c) => ({ ...c, discount_type: v as PromotionType, discount_value: v === "free_delivery" ? null : c.discount_value }))}
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
            {form.discount_type !== "free_delivery" && (
              <div className="space-y-1.5">
                <Label>
                  {form.discount_type === "percentage" ? "Pourcentage de réduction" : `Montant de la réduction (${currencySymbol(currency)})`}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={form.discount_type === "percentage" ? 99 : undefined}
                  value={form.discount_value ?? ""}
                  onChange={(e) => setForm((c) => ({ ...c, discount_value: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Visibilité</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => {
                  const visibility = v as PromoVisibility;
                  setForm((c) => ({ ...c, visibility }));
                  if (visibility === "public") setTargets([]);
                  else if (visibility === "personal" && targets.length > 1) setTargets((t) => t.slice(0, 1));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Tous les clients</SelectItem>
                  <SelectItem value="targeted">Clients sélectionnés</SelectItem>
                  <SelectItem value="personal">Client spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.visibility !== "public" && (
              <div className="space-y-1.5">
                <Label>{form.visibility === "personal" ? "Client" : "Clients ciblés"}</Label>
                <CustomerMultiSelect restaurantId={restaurantId} selected={targets} onChange={setTargets} singleSelect={form.visibility === "personal"} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Limite globale d'utilisations</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Illimité"
                  value={form.max_total_uses ?? ""}
                  onChange={(e) => setForm((c) => ({ ...c, max_total_uses: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Limite par client</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_uses_per_customer}
                  onChange={(e) => setForm((c) => ({ ...c, max_uses_per_customer: Number(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="datetime-local" value={toLocalInputValue(form.starts_at)} onChange={(e) => setForm((c) => ({ ...c, starts_at: fromLocalInputValue(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="datetime-local" value={toLocalInputValue(form.ends_at)} onChange={(e) => setForm((c) => ({ ...c, ends_at: fromLocalInputValue(e.target.value) }))} />
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
              <span className="text-sm font-medium">Actif</span>
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm((c) => ({ ...c, is_active: checked }))} />
            </label>
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
            <AlertDialogTitle>Supprimer ce code promo ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est définitive. « {deleteTarget?.code} » ne pourra plus être utilisé.</AlertDialogDescription>
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
