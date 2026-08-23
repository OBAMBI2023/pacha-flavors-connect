import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import { MENU_BUCKET, type DbMenuItem } from "@/lib/menu-db";
import {
  createOffer,
  deleteOffer,
  fetchOffers,
  fetchOffersAnalytics,
  getOfferDisplayStatus,
  setOfferStatus,
  updateOffer,
  type Offer,
  type OfferAnalytics,
  type OfferInput,
  type OfferStatus,
} from "@/lib/offers";

const STATUS_META: Record<OfferStatus, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  active: { label: "Active", className: "bg-primary text-primary-foreground" },
  disabled: { label: "Désactivée", className: "bg-muted text-muted-foreground" },
  expired: { label: "Expirée", className: "bg-destructive/10 text-destructive" },
};

function money(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function toLocalInputValue(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function emptyForm(products: DbMenuItem[]): OfferInput {
  const now = new Date();
  const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const firstPriced = products.find((p) => p.price != null);
  return {
    product_id: firstPriced?.id ?? "",
    title: "",
    description: "",
    image_path: null,
    original_price: firstPriced?.price ?? 0,
    offer_price: 0,
    starts_at: now.toISOString(),
    ends_at: later.toISOString(),
  };
}

export function MarketingPanel({ restaurantId, products }: { restaurantId: string; products: DbMenuItem[] }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [analytics, setAnalytics] = useState<OfferAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferInput>(() => emptyForm(products));
  const [preview, setPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);

  const pricedProducts = useMemo(() => products.filter((p) => p.price != null), [products]);
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  async function refresh() {
    setLoading(true);
    try {
      setOffers(await fetchOffers(restaurantId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les offres.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAnalytics() {
    setAnalyticsLoading(true);
    try {
      setAnalytics(await fetchOffersAnalytics());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les statistiques.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    void refreshAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(products));
    setPreview(null);
    setDialogOpen(true);
  }

  function openEdit(offer: Offer) {
    setEditing(offer);
    setForm({
      product_id: offer.product_id,
      title: offer.title,
      description: offer.description ?? "",
      image_path: offer.image_path,
      original_price: offer.original_price,
      offer_price: offer.offer_price,
      starts_at: offer.starts_at,
      ends_at: offer.ends_at,
    });
    setPreview(offer.image_path ? supabase.storage.from(MENU_BUCKET).getPublicUrl(offer.image_path).data.publicUrl : null);
    setDialogOpen(true);
  }

  async function uploadImage(file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${restaurantId}/offers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MENU_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error("Impossible d'envoyer l'image.", { description: error.message }); return; }
    setForm((c) => ({ ...c, image_path: path }));
    setPreview(supabase.storage.from(MENU_BUCKET).getPublicUrl(path).data.publicUrl);
  }

  async function save() {
    if (!form.product_id) { toast.error("Sélectionnez un plat."); return; }
    if (!form.title.trim()) { toast.error("Le titre est requis."); return; }
    if (!form.original_price || form.original_price <= 0) { toast.error("Indiquez le prix original."); return; }
    if (!form.offer_price || form.offer_price <= 0) { toast.error("Indiquez le prix promotionnel."); return; }
    if (form.offer_price >= form.original_price) { toast.error("Le prix promotionnel doit être inférieur au prix original."); return; }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast.error("La date de fin doit être après la date de début.");
      return;
    }

    setBusy(true);
    try {
      const payload: OfferInput = { ...form, description: form.description?.trim() || null };
      if (editing) await updateOffer(editing.id, payload);
      else await createOffer(restaurantId, payload);
      toast.success(editing ? "Offre mise à jour" : "Offre créée");
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer l'offre.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(offer: Offer, next: "active" | "disabled") {
    setBusy(true);
    try {
      await setOfferStatus(offer.id, next);
      toast.success(next === "active" ? "Offre activée" : "Offre désactivée");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour l'offre.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteOffer(deleteTarget.id);
      toast.success("Offre supprimée");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer l'offre.");
    } finally {
      setBusy(false);
    }
  }

  const selectedProduct = form.product_id ? productsById.get(form.product_id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Marketing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Créez des offres promotionnelles visibles dans l'espace « Offres » de vos clients, et suivez leurs performances.</p>
      </div>

      <Tabs defaultValue="offres" className="space-y-5">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="offres">Offres</TabsTrigger>
          <TabsTrigger value="performances">Performances</TabsTrigger>
        </TabsList>

        <TabsContent value="offres" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{offers.length} offre{offers.length > 1 ? "s" : ""}</p>
            <Button onClick={openCreate} disabled={pricedProducts.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle offre
            </Button>
          </div>

          {pricedProducts.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">Ajoutez d'abord un plat avec un prix dans l'onglet Carte pour pouvoir créer une offre.</Card>
          ) : loading ? (
            <Card className="p-6 text-sm text-muted-foreground">Chargement...</Card>
          ) : offers.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">Aucune offre pour le moment.</Card>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => {
                const product = productsById.get(offer.product_id);
                const displayStatus = getOfferDisplayStatus(offer);
                const meta = STATUS_META[displayStatus];
                return (
                  <Card key={offer.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {offer.image_path && (
                          <img src={supabase.storage.from(MENU_BUCKET).getPublicUrl(offer.image_path).data.publicUrl} alt={offer.title} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{offer.title}</p>
                          <Badge className={meta.className}>{meta.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {product?.name ?? "Plat introuvable"} · {money(offer.offer_price)} <span className="line-through">{money(offer.original_price)}</span>
                        </p>
                        {(offer.starts_at || offer.ends_at) && (
                          <p className="text-xs text-muted-foreground">
                            {offer.starts_at ? `Du ${new Date(offer.starts_at).toLocaleDateString("fr-FR")} ` : ""}
                            {offer.ends_at ? `au ${new Date(offer.ends_at).toLocaleDateString("fr-FR")}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={offer.status === "active"}
                        disabled={busy}
                        aria-label={offer.status === "active" ? "Désactiver l'offre" : "Activer l'offre"}
                        onCheckedChange={(checked) => void toggleStatus(offer, checked ? "active" : "disabled")}
                      />
                      <Button variant="outline" size="icon" onClick={() => openEdit(offer)} aria-label="Modifier"><PencilLine className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(offer)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performances" className="space-y-3">
          {analyticsLoading ? (
            <Card className="p-6 text-sm text-muted-foreground">Chargement...</Card>
          ) : analytics.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">Aucune donnée pour le moment.</Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Offre</th>
                    <th className="px-4 py-3 text-right">Destinataires</th>
                    <th className="px-4 py-3 text-right">Ouvertures</th>
                    <th className="px-4 py-3 text-right">Vues</th>
                    <th className="px-4 py-3 text-right">Clics</th>
                    <th className="px-4 py-3 text-right">Conversions</th>
                    <th className="px-4 py-3 text-right">Taux de conversion</th>
                    <th className="px-4 py-3 text-right">Revenu généré</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((row) => (
                    <tr key={row.offer_id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{row.title}</td>
                      <td className="px-4 py-3 text-right">{row.recipients_count}</td>
                      <td className="px-4 py-3 text-right">{row.opened_count}</td>
                      <td className="px-4 py-3 text-right">{row.views_count}</td>
                      <td className="px-4 py-3 text-right">{row.clicks_count}</td>
                      <td className="px-4 py-3 text-right">{row.conversions_count}</td>
                      <td className="px-4 py-3 text-right">{row.conversion_rate}%</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'offre" : "Nouvelle offre"}</DialogTitle>
            <DialogDescription>Visible dans l'espace « Offres » de vos clients uniquement une fois activée et pendant sa période de validité.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Photo</Label>
              <label className="group relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted hover:border-primary">
                {preview ? (
                  <img src={preview} alt="Aperçu" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground"><ImagePlus className="h-8 w-8" /> Ajouter une photo</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }}
                />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Plat concerné</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => {
                  const p = productsById.get(v);
                  setForm((c) => ({ ...c, product_id: v, original_price: p?.price ?? c.original_price }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choisir un plat" /></SelectTrigger>
                <SelectContent>
                  {pricedProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.price!.toLocaleString("fr-FR")} FCFA</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Titre de l'offre</Label>
              <Input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Ex: -20% sur le Poulet Braisé" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Prix original (FCFA)</Label>
                <Input type="number" min={1} value={form.original_price || ""} onChange={(e) => setForm((c) => ({ ...c, original_price: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Prix promotionnel (FCFA)</Label>
                <Input type="number" min={1} value={form.offer_price || ""} onChange={(e) => setForm((c) => ({ ...c, offer_price: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            {selectedProduct?.price != null && form.original_price !== selectedProduct.price && (
              <p className="text-xs text-muted-foreground">Le prix actuel du plat est {money(selectedProduct.price)} -- le prix original de l'offre peut différer si le prix du plat a changé depuis.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Début (optionnel)</Label>
                <Input type="datetime-local" value={form.starts_at ? toLocalInputValue(form.starts_at) : ""} onChange={(e) => setForm((c) => ({ ...c, starts_at: fromLocalInputValue(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin (optionnel)</Label>
                <Input type="datetime-local" value={form.ends_at ? toLocalInputValue(form.ends_at) : ""} onChange={(e) => setForm((c) => ({ ...c, ends_at: fromLocalInputValue(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => void save()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette offre ?</AlertDialogTitle>
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
