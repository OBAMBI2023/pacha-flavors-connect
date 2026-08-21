import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MENU_BUCKET, type DbMenuItem, useAdminMenuData } from "@/lib/menu-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrdersPanel } from "@/components/admin/orders/OrdersPanel";
import { DashboardHome } from "@/components/admin/home/DashboardHome";
import { StatisticsPanel } from "@/components/admin/stats/StatisticsPanel";
import { FinancialPanel } from "@/components/admin/finance/FinancialPanel";
import { NotificationBell } from "@/components/admin/notifications/NotificationBell";
import { SubscriptionCard } from "@/components/admin/settings/SubscriptionCard";

const TITLE = "Administration du restaurant";
const DESCRIPTION = "Gestion compacte de la carte, de la vitrine et des coordonnées du restaurant.";
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024;

type Cat = { id: string; label: string; position: number };
type RestaurantForm = { name: string; logo_url: string; cover_url: string; address: string; commune: string; city: string; phone: string; whatsapp_phone: string; email: string; is_public: boolean };
type ItemForm = { name: string; subtitle: string; description: string; price: string; category_id: string; position: string; available: boolean; daily: boolean; image_path: string };

export const Route = createFileRoute("/admin")({ ssr: false, head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { name: "robots", content: "noindex" }] }), component: AdminPage });

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60); }
function emptyRestaurantForm(data?: any): RestaurantForm { return { name: data?.name ?? "", logo_url: data?.logo_url ?? "", cover_url: data?.cover_url ?? "", address: data?.address ?? "", commune: data?.commune ?? "", city: data?.city ?? "", phone: data?.phone ?? "", whatsapp_phone: data?.whatsapp_phone ?? "", email: data?.email ?? "", is_public: Boolean(data?.is_public) }; }
function mapsQuery(form: Pick<RestaurantForm, "address" | "commune" | "city">) { return [form.address, form.commune, form.city].map((v) => v.trim()).filter(Boolean).join(", "); }
function mapsUrl(form: Pick<RestaurantForm, "address" | "commune" | "city">) { const q = mapsQuery(form); return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : ""; }
export default function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, canManageMenu, restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useAdminMenuData(restaurantId);
  const [tab, setTab] = useState("accueil");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDelete, setCategoryDelete] = useState<Cat | null>(null);
  const [itemDelete, setItemDelete] = useState<DbMenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Cat | null>(null);
  const [editingItem, setEditingItem] = useState<DbMenuItem | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [restaurantForm, setRestaurantForm] = useState<RestaurantForm>(emptyRestaurantForm());
  const [itemForm, setItemForm] = useState<ItemForm>({ name: "", subtitle: "", description: "", price: "", category_id: "", position: "0", available: true, daily: false, image_path: "" });
  const [itemPreview, setItemPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const loadedRestaurantId = useRef<string | null>(null);
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);
  useEffect(() => {
    // Only hydrate the form from server data on first load or when switching
    // to a different restaurant. Re-syncing on every refetch (e.g. after an
    // asset upload's invalidateQueries) would clobber in-progress, unsaved
    // edits like a typed restaurant name with the last-saved server value.
    if (data?.restaurant && loadedRestaurantId.current !== data.restaurant.id) {
      setRestaurantForm(emptyRestaurantForm(data.restaurant));
      loadedRestaurantId.current = data.restaurant.id;
    }
  }, [data?.restaurant]);
  useEffect(() => { setLogoPreview(restaurantForm.logo_url || null); setCoverPreview(restaurantForm.cover_url || null); }, [restaurantForm.logo_url, restaurantForm.cover_url]);
  useEffect(() => { if (!editingItem?.image_path) setItemPreview(null); else setItemPreview(supabase.storage.from(MENU_BUCKET).getPublicUrl(editingItem.image_path).data.publicUrl); }, [editingItem]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-menu-data", restaurantId] });
    if (data?.restaurant?.slug) await queryClient.invalidateQueries({ queryKey: ["menu-data", data.restaurant.slug] });
  };
  const restaurant = data?.restaurant ?? null;
  const publicHref = restaurant?.slug ? `/r/${restaurant.slug}` : "/";
  const mapPreview = mapsUrl(restaurantForm);

  const categoryCounts = useMemo(() => { const counts = new Map<string | null, number>(); for (const row of data?.rows ?? []) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1); return counts; }, [data?.rows]);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter((row) => {
      if (categoryFilter !== "all" && row.category_id !== categoryFilter) return false;
      if (!q) return true;
      const cat = data?.categories.find((c) => c.id === row.category_id)?.label ?? "";
      return [row.name, row.subtitle ?? "", row.description, cat].some((value) => value.toLowerCase().includes(q));
    });
  }, [data?.categories, data?.rows, categoryFilter, search]);

  if (loading) return <p className="p-10 text-sm text-muted-foreground">Chargement...</p>;
  if (!user) return null;
  if (!restaurantId) return <SimpleAccess onLogout={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }} email={user.email ?? ""} title="Accès réservé" message="Votre compte n'est pas encore rattaché à un restaurant." />;
  if (!canManageMenu) return <SimpleAccess onLogout={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }} email={user.email ?? ""} title="Accès réservé" message="Votre rôle ne permet pas de modifier le menu." publicHref={publicHref} />;

  async function saveCategory(): Promise<void> {
    const rid = restaurantId;
    if (!rid || !categoryLabel.trim()) return;
    setBusy(true);
    const trimmed = categoryLabel.trim();
    const result = editingCategory
      ? await supabase.from("restaurant_categories").update({ name: trimmed } as any).eq("id", editingCategory.id).eq("restaurant_id", rid)
      : await supabase.from("restaurant_categories").insert({ restaurant_id: rid, name: trimmed, slug: `${slugify(trimmed)}-${Date.now().toString(36)}`, sort_order: (data?.categories.length ?? 0) + 1 } as any);
    setBusy(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(editingCategory ? "Catégorie mise à jour" : "Catégorie ajoutée");
    setEditingCategory(null); setCategoryLabel(""); setCategoryDialogOpen(false); await refresh();
  }

  async function saveItem(): Promise<void> {
    const rid = restaurantId;
    if (!rid || !itemForm.name.trim()) return;
    setBusy(true);
    const payload = { name: itemForm.name.trim(), subtitle: itemForm.subtitle.trim() || null, description: itemForm.description.trim(), price: itemForm.price.trim() === "" ? null : Number(itemForm.price), category_id: itemForm.category_id || null, sort_order: Number(itemForm.position) || 0, is_available: itemForm.available, is_daily_menu: itemForm.daily };
    const result = editingItem
      ? await supabase.from("restaurant_products").update(payload as any).eq("id", editingItem.id).eq("restaurant_id", rid)
      : await supabase.from("restaurant_products").insert({ restaurant_id: rid, slug: `${slugify(itemForm.name.trim())}-${Date.now().toString(36)}`, image_path: itemForm.image_path || null, ...payload } as any);
    setBusy(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(editingItem ? "Plat mis à jour" : "Plat ajouté");
    setEditingItem(null); setItemDialogOpen(false); setItemPreview(null);
    setItemForm({ name: "", subtitle: "", description: "", price: "", category_id: data?.categories[0]?.id ?? "", position: String((data?.rows.length ?? 0) + 1), available: true, daily: false, image_path: "" });
    await refresh();
  }

  async function saveRestaurant(): Promise<void> {
    const rid = restaurantId;
    if (!rid) return;
    setBusy(true);
    const { error } = await supabase.from("restaurants").update({ name: restaurantForm.name.trim(), logo_url: restaurantForm.logo_url.trim() || null, cover_url: restaurantForm.cover_url.trim() || null, address: restaurantForm.address.trim() || null, commune: restaurantForm.commune.trim() || null, city: restaurantForm.city.trim() || null, phone: restaurantForm.phone.trim() || null, whatsapp_phone: restaurantForm.whatsapp_phone.trim() || null, email: restaurantForm.email.trim() || null, is_public: restaurantForm.is_public } as any).eq("id", rid);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vitrine mise à jour");
    await refresh();
  }

  async function uploadRestaurantAsset(file: File, field: "logo_url" | "cover_url"): Promise<void> {
    const rid = restaurantId;
    if (!rid) return;
    const label = field === "logo_url" ? "logo" : "cover";

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Format d'image non supporté.");
      return;
    }
    if (file.size > MAX_ASSET_SIZE_BYTES) {
      toast.error("Image trop volumineuse.");
      return;
    }

    setBusy(true);
    const toastId = toast.loading(`Upload du ${label} en cours...`);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${rid}/${field}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MENU_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setBusy(false);
      toast.error(`Impossible d'envoyer le ${label}.`, { id: toastId, description: error.message });
      return;
    }
    const url = supabase.storage.from(MENU_BUCKET).getPublicUrl(path).data.publicUrl;
    const { error: updateError } = await supabase.from("restaurants").update({ [field]: url } as any).eq("id", rid);
    if (updateError) {
      setBusy(false);
      toast.error(`Impossible de sauvegarder le ${label}.`, { id: toastId, description: updateError.message });
      return;
    }
    setRestaurantForm((current) => ({ ...current, [field]: url }));
    setBusy(false);
    toast.success(`${label === "logo" ? "Logo" : "Cover"} mis à jour avec succès.`, { id: toastId });
    await refresh();
  }

  async function uploadItemImage(file: File): Promise<void> {
    const rid = restaurantId;
    if (!rid) return;
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${rid}/menu/${Date.now().toString(36)}.${ext}`;
    const { error } = await supabase.storage.from(MENU_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setBusy(false); toast.error(error.message); return; }
    setItemForm((current) => ({ ...current, image_path: path }));
    setItemPreview(supabase.storage.from(MENU_BUCKET).getPublicUrl(path).data.publicUrl);
    setBusy(false);
    toast.success("Photo du plat mise à jour");
  }

  async function removeCategory(): Promise<void> { const rid = restaurantId; if (!categoryDelete || !rid) return; setBusy(true); const { error } = await supabase.from("restaurant_categories").delete().eq("id", categoryDelete.id).eq("restaurant_id", rid); setBusy(false); if (error) { toast.error(error.message); return; } toast.success("Catégorie supprimée"); setCategoryDelete(null); await refresh(); }
  async function removeItem(): Promise<void> { const rid = restaurantId; if (!itemDelete || !rid) return; setBusy(true); const { error } = await supabase.from("restaurant_products").delete().eq("id", itemDelete.id).eq("restaurant_id", rid); setBusy(false); if (error) { toast.error(error.message); return; } toast.success("Plat supprimé"); setItemDelete(null); await refresh(); }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Toaster />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div><p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">{restaurant?.name ?? "Restaurant"}</p><h1 className="mt-2 font-display text-4xl font-semibold">Administration</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Gestion compacte de la carte, de la vitrine et des coordonnées.</p></div>
        <div className="flex flex-wrap items-center gap-2"><NotificationBell restaurantId={restaurantId} /><Button variant="outline" onClick={() => window.open(publicHref, "_blank", "noopener,noreferrer")}>Prévisualiser mon site</Button><Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}>Déconnexion</Button></div>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0"><TabsTrigger value="accueil">Accueil</TabsTrigger><TabsTrigger value="commandes">Commandes</TabsTrigger><TabsTrigger value="statistiques">Statistiques</TabsTrigger><TabsTrigger value="finances">Finances</TabsTrigger><TabsTrigger value="menu">Carte</TabsTrigger><TabsTrigger value="storefront">Site vitrine</TabsTrigger><TabsTrigger value="contact">Coordonnées</TabsTrigger><TabsTrigger value="settings">Paramètres</TabsTrigger></TabsList>
        <TabsContent value="accueil"><DashboardHome restaurantId={restaurantId} publicHref={publicHref} onNavigateTab={setTab} /></TabsContent>
        <TabsContent value="commandes"><OrdersPanel restaurantId={restaurantId} /></TabsContent>
        <TabsContent value="statistiques"><StatisticsPanel /></TabsContent>
        <TabsContent value="finances"><FinancialPanel /></TabsContent>
        <TabsContent value="menu" className="space-y-6"><Card className="p-5"><MenuCategoriesPanel categories={data?.categories ?? []} counts={categoryCounts} busy={busy} onAdd={() => { setEditingCategory(null); setCategoryLabel(""); setCategoryDialogOpen(true); }} onEdit={(cat) => { setEditingCategory(cat); setCategoryLabel(cat.label); setCategoryDialogOpen(true); }} onDelete={setCategoryDelete} /></Card><Card className="p-5"><MenuItemsPanel rows={filteredRows} categories={data?.categories ?? []} busy={busy} search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onAdd={() => { setEditingItem(null); setItemPreview(null); setItemForm({ name: "", subtitle: "", description: "", price: "", category_id: data?.categories[0]?.id ?? "", position: String((data?.rows.length ?? 0) + 1), available: true, daily: false, image_path: "" }); setItemDialogOpen(true); }} onEdit={(row) => { setEditingItem(row); setItemForm({ name: row.name, subtitle: row.subtitle ?? "", description: row.description, price: row.price === null ? "" : String(row.price), category_id: row.category_id ?? "", position: String(row.position), available: row.available, daily: row.daily, image_path: row.image_path ?? "" }); setItemDialogOpen(true); }} onDelete={setItemDelete} /></Card></TabsContent>
        <TabsContent value="storefront" className="grid gap-6 lg:grid-cols-2"><Card className="space-y-5 p-5"><div><h2 className="font-display text-2xl font-semibold">Site vitrine</h2><p className="text-sm text-muted-foreground">Nom, visibilité publique, logo, cover et coordonnées.</p></div><div className="space-y-4"><Field label="Nom du restaurant"><Input value={restaurantForm.name} onChange={(e) => setRestaurantForm((c) => ({ ...c, name: e.target.value }))} /></Field><div className="grid gap-4 md:grid-cols-2"><AssetField label="Logo" preview={logoPreview} onPick={(file) => void uploadRestaurantAsset(file, "logo_url")} busy={busy} accept={ACCEPTED_IMAGE_TYPES.join(",")} /><AssetField label="Cover" preview={coverPreview} onPick={(file) => void uploadRestaurantAsset(file, "cover_url")} busy={busy} fullWidth accept={ACCEPTED_IMAGE_TYPES.join(",")} /></div><div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3"><Switch checked={restaurantForm.is_public} onCheckedChange={(checked) => setRestaurantForm((c) => ({ ...c, is_public: checked }))} /><div><p className="text-sm font-medium">Visibilité publique</p><p className="text-xs text-muted-foreground">Le site du tenant est exposé publiquement.</p></div></div></div><Button onClick={() => void saveRestaurant()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer la vitrine"}</Button></Card><Card className="space-y-4 p-5"><h3 className="font-semibold">Aperçu</h3><div className="overflow-hidden rounded-3xl border border-border"><div className="min-h-48 bg-muted" style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!coverPreview && <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">Fond neutre générique</div>}</div></div><div className="flex items-center gap-3 rounded-2xl border border-border p-4">{logoPreview ? <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded-2xl object-cover" /> : <div className="h-14 w-14 rounded-2xl bg-muted" />}<div><p className="font-medium">{restaurantForm.name || restaurant?.name || "Restaurant"}</p><p className="text-sm text-muted-foreground">{`/r/${restaurant?.slug ?? "slug"}`}</p></div></div></Card></TabsContent>
        <TabsContent value="contact" className="grid gap-6 lg:grid-cols-2"><Card className="space-y-4 p-5"><div><h2 className="font-display text-2xl font-semibold">Coordonnées</h2><p className="text-sm text-muted-foreground">Adresse, téléphone, WhatsApp et email.</p></div><div className="grid gap-4 md:grid-cols-2"><Field label="Adresse"><Textarea value={restaurantForm.address} onChange={(e) => setRestaurantForm((c) => ({ ...c, address: e.target.value }))} /></Field><Field label="Commune"><Input value={restaurantForm.commune} onChange={(e) => setRestaurantForm((c) => ({ ...c, commune: e.target.value }))} /></Field><Field label="Ville"><Input value={restaurantForm.city} onChange={(e) => setRestaurantForm((c) => ({ ...c, city: e.target.value }))} /></Field><Field label="Téléphone"><Input value={restaurantForm.phone} onChange={(e) => setRestaurantForm((c) => ({ ...c, phone: e.target.value }))} /></Field><Field label="WhatsApp"><Input value={restaurantForm.whatsapp_phone} onChange={(e) => setRestaurantForm((c) => ({ ...c, whatsapp_phone: e.target.value }))} /></Field><Field label="Email"><Input type="email" value={restaurantForm.email} onChange={(e) => setRestaurantForm((c) => ({ ...c, email: e.target.value }))} /></Field></div><Button onClick={() => void saveRestaurant()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer les coordonnées"}</Button></Card><Card className="space-y-4 p-5"><div><h3 className="font-semibold">Localisation</h3><p className="text-sm text-muted-foreground">La carte est masquée si aucune adresse exploitable n’existe.</p></div>{mapPreview ? <iframe title="Prévisualisation Google Maps" src={mapPreview} className="h-80 w-full rounded-3xl border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="flex h-80 items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted-foreground">Aucune carte</div>}<div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground"><MapPin className="mb-2 h-4 w-4" />{mapsQuery(restaurantForm) || "Renseignez une adresse, une commune ou une ville."}</div></Card></TabsContent>
        <TabsContent value="settings" className="space-y-6"><Card className="p-5"><h2 className="font-display text-2xl font-semibold">Paramètres</h2><p className="mt-2 text-sm text-muted-foreground">Section réservée aux réglages complémentaires sans toucher à l’isolation multi-tenant.</p></Card><SubscriptionCard restaurantId={restaurantId} /></TabsContent>
      </Tabs>
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingCategory ? "Modifier la catégorie" : "Ajouter une catégorie"}</DialogTitle><DialogDescription>Formulaire compact dédié aux catégories.</DialogDescription></DialogHeader><Field label="Nom"><Input value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} /></Field><DialogFooter><Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={busy}>Annuler</Button><Button onClick={() => void saveCategory()} disabled={busy}>{busy ? "Sauvegarde..." : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingItem ? "Modifier le plat" : "Ajouter un plat"}</DialogTitle><DialogDescription>Le même formulaire sert à la création et à l’édition.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Field label="Nom"><Input value={itemForm.name} onChange={(e) => setItemForm((c) => ({ ...c, name: e.target.value }))} /></Field><Field label="Sous-titre"><Input value={itemForm.subtitle} onChange={(e) => setItemForm((c) => ({ ...c, subtitle: e.target.value }))} /></Field><div className="md:col-span-2"><Field label="Description"><Textarea value={itemForm.description} onChange={(e) => setItemForm((c) => ({ ...c, description: e.target.value }))} /></Field></div><Field label="Prix"><Input type="number" min={0} value={itemForm.price} onChange={(e) => setItemForm((c) => ({ ...c, price: e.target.value }))} /></Field><Field label="Catégorie"><select value={itemForm.category_id} onChange={(e) => setItemForm((c) => ({ ...c, category_id: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sans catégorie</option>{data?.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field><Field label="Ordre"><Input type="number" value={itemForm.position} onChange={(e) => setItemForm((c) => ({ ...c, position: e.target.value }))} /></Field><div className="flex items-end gap-6 md:col-span-2"><label className="flex items-center gap-2 text-sm"><Switch checked={itemForm.available} onCheckedChange={(v) => setItemForm((c) => ({ ...c, available: v }))} /> Disponible</label><label className="flex items-center gap-2 text-sm"><Switch checked={itemForm.daily} onCheckedChange={(v) => setItemForm((c) => ({ ...c, daily: v }))} /> Menu du jour</label></div><div className="md:col-span-2"><AssetField label="Photo" preview={itemPreview || itemForm.image_path} onPick={(file) => void uploadItemImage(file)} busy={busy} /></div></div><DialogFooter><Button variant="outline" onClick={() => setItemDialogOpen(false)} disabled={busy}>Annuler</Button><Button onClick={() => void saveItem()} disabled={busy}>{busy ? "Sauvegarde..." : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={Boolean(categoryDelete)} onOpenChange={(open) => !open && setCategoryDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle><AlertDialogDescription>Cette action est définitive.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => void removeCategory()} disabled={busy}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(itemDelete)} onOpenChange={(open) => !open && setItemDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce plat ?</AlertDialogTitle><AlertDialogDescription>Cette action est définitive.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => void removeItem()} disabled={busy}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}
function SimpleAccess({ title, message, email, publicHref, onLogout }: { title: string; message: string; email: string; publicHref?: string; onLogout: () => Promise<void> }) {
  return (<main className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl font-semibold">{title}</h1><p className="mt-3 text-sm text-muted-foreground">{message}</p><p className="mt-2 text-xs text-muted-foreground">{email}</p><div className="mt-6 flex flex-wrap justify-center gap-2">{publicHref ? <a href={publicHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm">Voir le site</a> : null}<Button variant="outline" onClick={() => void onLogout()}>Se déconnecter</Button></div><Toaster /></main>);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function AssetField({ label, preview, onPick, busy, fullWidth = false, accept = "image/*" }: { label: string; preview: string | null; onPick: (file: File) => void; busy: boolean; fullWidth?: boolean; accept?: string }) {
  return (<div className={`space-y-2 ${fullWidth ? "md:col-span-2" : ""}`}><Label>{label}</Label><div className="rounded-2xl border border-dashed border-border p-4">{preview ? <img src={preview} alt={label} className="mb-3 h-24 w-full rounded-2xl object-cover" /> : <div className="mb-3 h-24 rounded-2xl bg-muted" />}<Input type="file" accept={accept} disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) onPick(file); e.target.value = ""; }} /></div></div>);
}

function MenuCategoriesPanel({ categories, counts, busy, onAdd, onEdit, onDelete }: { categories: Cat[]; counts: Map<string | null, number>; busy: boolean; onAdd: () => void; onEdit: (cat: Cat) => void; onDelete: (cat: Cat) => void; }) {
  return (<div><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">Catégories</h2><p className="text-sm text-muted-foreground">Vue compacte avec ajout, renommage et suppression.</p></div><Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Ajouter une catégorie</Button></div><div className="mt-4 space-y-2">{categories.map((cat) => (<div key={cat.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3"><div><p className="font-medium">{cat.label}</p><p className="text-xs text-muted-foreground">{counts.get(cat.id) ?? 0} plat(s)</p></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" disabled={busy} onClick={() => onEdit(cat)}><PencilLine className="mr-2 h-4 w-4" />Modifier</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => onDelete(cat)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button></div></div>))}</div></div>);
}

function MenuItemsPanel({ rows, categories, busy, search, setSearch, categoryFilter, setCategoryFilter, onAdd, onEdit, onDelete }: { rows: DbMenuItem[]; categories: Cat[]; busy: boolean; search: string; setSearch: (v: string) => void; categoryFilter: string; setCategoryFilter: (v: string) => void; onAdd: () => void; onEdit: (row: DbMenuItem) => void; onDelete: (row: DbMenuItem) => void; }) {
  return (<div><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">Plats</h2><p className="text-sm text-muted-foreground">Liste compacte avec miniature, prix, catégorie et statut.</p></div><Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Ajouter un plat</Button></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un plat..." className="pl-9" /></div><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Toutes les catégories</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select></div><div className="mt-4 space-y-2">{rows.map((row) => { const cat = categories.find((c) => c.id === row.category_id)?.label ?? "Sans catégorie"; const src = row.image_path ? supabase.storage.from(MENU_BUCKET).getPublicUrl(row.image_path).data.publicUrl : null; return (<div key={row.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">{src ? <img src={src} alt={row.name} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{row.name}</p>{row.daily ? <Badge variant="secondary">Menu du jour</Badge> : null}<Badge variant={row.available ? "default" : "outline"}>{row.available ? "Disponible" : "Indisponible"}</Badge></div><p className="text-sm text-muted-foreground">{cat} • {row.price === null ? "Prix sur demande" : `${row.price} FCFA`} • ordre {row.position}</p></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" disabled={busy} onClick={() => onEdit(row)}><PencilLine className="mr-2 h-4 w-4" />Modifier</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => onDelete(row)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button></div></div>); })}</div></div>);
}









