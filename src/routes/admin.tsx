import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, MapPin, PencilLine, Plus, Search, Trash2 } from "lucide-react";
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
import { useOrdersAlert } from "@/hooks/useOrdersAlert";
import { DashboardHome } from "@/components/admin/home/DashboardHome";
import { StatisticsPanel } from "@/components/admin/stats/StatisticsPanel";
import { FinancialPanel } from "@/components/admin/finance/FinancialPanel";
import { PromotionsPanel } from "@/components/admin/promotions/PromotionsPanel";
import { PromoCodesPanel } from "@/components/admin/promotions/PromoCodesPanel";
import { DriversPanel } from "@/components/admin/drivers/DriversPanel";
import { MarketingPanel } from "@/components/admin/marketing/MarketingPanel";
import { ReviewsPanel } from "@/components/admin/reviews/ReviewsPanel";
import { OptionGroupsManager } from "@/components/admin/menu/OptionGroupsManager";
import { AvailabilityPanel } from "@/components/admin/availability/AvailabilityPanel";
import { VisitorsPanel } from "@/components/admin/visitors/VisitorsPanel";
import { CustomersPanel } from "@/components/admin/customers/CustomersPanel";
import { createPromotion, fetchPromotions, setPromotionStatus, updatePromotion, type Promotion } from "@/lib/promotions";
import { NotificationBell } from "@/components/admin/notifications/NotificationBell";
import { SubscriptionCard } from "@/components/admin/settings/SubscriptionCard";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import { FulfillmentSettingsCard } from "@/components/admin/settings/FulfillmentSettingsCard";
import { useRestaurantTheme } from "@/hooks/useRestaurantTheme";

const TITLE = "Administration du restaurant";
const DESCRIPTION = "Gestion compacte de la carte, de la vitrine et des coordonnées du restaurant.";
const ADMIN_NAV_ITEMS = [
  { value: "accueil", label: "Accueil" },
  { value: "commandes", label: "Commandes" },
  { value: "clients", label: "Clients" },
  { value: "livreurs", label: "Livreurs" },
  { value: "statistiques", label: "Statistiques" },
  { value: "visiteurs", label: "Visiteurs" },
  { value: "finances", label: "Finances" },
  { value: "menu", label: "Carte" },
  { value: "promotions", label: "Promotions" },
  { value: "marketing", label: "Marketing" },
  { value: "avis", label: "Avis" },
  { value: "storefront", label: "Site vitrine" },
  { value: "contact", label: "Coordonnées" },
  { value: "disponibilite", label: "Disponibilité" },
  { value: "settings", label: "Paramètres" },
] as const;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_LOGO_DIMENSION_PX = 400;
const RECOMMENDED_COVER_WIDTH_PX = 1280;

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid image"));
    };
    img.src = url;
  });
}

type Cat = { id: string; label: string; position: number };
type RestaurantForm = { name: string; logo_url: string; cover_url: string; address: string; commune: string; city: string; phone: string; whatsapp_phone: string; email: string; is_public: boolean; lat: string; lng: string };
type ItemForm = { name: string; subtitle: string; description: string; price: string; prep_time_minutes: string; category_id: string; position: string; available: boolean; daily: boolean; image_path: string; promotionEnabled: boolean; promotionalPrice: string };
function emptyItemForm(data?: { categoryId?: string | undefined; position?: string | undefined }): ItemForm {
  return { name: "", subtitle: "", description: "", price: "", prep_time_minutes: "", category_id: data?.categoryId ?? "", position: data?.position ?? "0", available: true, daily: false, image_path: "", promotionEnabled: false, promotionalPrice: "" };
}

export const Route = createFileRoute("/admin")({ ssr: false, head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { name: "robots", content: "noindex" }] }), component: AdminPage });

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60); }
function emptyRestaurantForm(data?: any): RestaurantForm { return { name: data?.name ?? "", logo_url: data?.logo_url ?? "", cover_url: data?.cover_url ?? "", address: data?.address ?? "", commune: data?.commune ?? "", city: data?.city ?? "", phone: data?.phone ?? "", whatsapp_phone: data?.whatsapp_phone ?? "", email: data?.email ?? "", is_public: Boolean(data?.is_public), lat: data?.lat != null ? String(data.lat) : "", lng: data?.lng != null ? String(data.lng) : "" }; }
function mapsQuery(form: Pick<RestaurantForm, "address" | "commune" | "city">) { return [form.address, form.commune, form.city].map((v) => v.trim()).filter(Boolean).join(", "); }
function mapsUrl(form: Pick<RestaurantForm, "address" | "commune" | "city">) { const q = mapsQuery(form); return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : ""; }
export default function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, canManageMenu, restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useAdminMenuData(restaurantId);
  useRestaurantTheme(restaurantId);
  const [tab, setTab] = useState("accueil");
  const ordersAlert = useOrdersAlert(restaurantId, { onViewOrder: () => setTab("commandes") });
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
  const [itemForm, setItemForm] = useState<ItemForm>(() => emptyItemForm());
  const [itemPreview, setItemPreview] = useState<string | null>(null);
  const [existingPromotion, setExistingPromotion] = useState<Promotion | null>(null);
  const [promotionsRefreshSignal, setPromotionsRefreshSignal] = useState(0);
  const [promotionsSubTab, setPromotionsSubTab] = useState<"produits" | "codes">("produits");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [togglingItemIds, setTogglingItemIds] = useState<Set<string>>(new Set());

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

  /** Preloads the product's promotion (if any) when opening the edit dialog, so the quick "Promotion" toggle reflects reality instead of always starting unchecked. */
  async function loadItemPromotion(productId: string, normalPrice: number | null): Promise<void> {
    const rid = restaurantId;
    if (!rid) return;
    try {
      const all = await fetchPromotions(rid);
      const promo = all.find((p) => p.product_id === productId) ?? null;
      setExistingPromotion(promo);
      if (promo && promo.type === "fixed_amount" && promo.value != null && normalPrice != null) {
        setItemForm((c) => ({ ...c, promotionEnabled: promo.status === "active", promotionalPrice: String(normalPrice - promo.value!) }));
      }
    } catch {
      // Non-fatal: the quick toggle just won't preload, editing still works.
    }
  }

  /** Quick promotion toggle in the item editor -- only ever creates/edits a simple fixed_amount promotion. A pre-existing percentage/free_delivery promotion (managed from the Promotions tab) is left untouched, matching the read-only notice shown in the dialog. */
  async function saveItemPromotion(productId: string, normalPrice: number | null): Promise<void> {
    if (existingPromotion && existingPromotion.type !== "fixed_amount") return;

    if (itemForm.promotionEnabled && normalPrice !== null) {
      const promoPrice = Number(itemForm.promotionalPrice);
      const discount = normalPrice - promoPrice;
      const promoInput = {
        product_id: productId,
        title: existingPromotion?.title ?? "Promotion",
        type: "fixed_amount" as const,
        value: discount,
        starts_at: existingPromotion?.starts_at ?? new Date().toISOString(),
        ends_at: existingPromotion?.ends_at ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
      if (existingPromotion) {
        await updatePromotion(existingPromotion.id, promoInput);
        if (existingPromotion.status !== "active") await setPromotionStatus(existingPromotion.id, "active");
      } else {
        await createPromotion(restaurantId as string, promoInput, "active");
      }
    } else if (existingPromotion && existingPromotion.status === "active") {
      await setPromotionStatus(existingPromotion.id, "inactive");
    }
    setPromotionsRefreshSignal((n) => n + 1);
  }

  async function saveItem(): Promise<void> {
    const rid = restaurantId;
    if (!rid || !itemForm.name.trim()) return;

    const normalPrice = itemForm.price.trim() === "" ? null : Number(itemForm.price);
    if (itemForm.promotionEnabled && (!existingPromotion || existingPromotion.type === "fixed_amount")) {
      const promoPrice = itemForm.promotionalPrice.trim() === "" ? null : Number(itemForm.promotionalPrice);
      if (normalPrice === null) { toast.error("Indiquez un prix normal avant d'activer une promotion."); return; }
      if (promoPrice === null || promoPrice <= 0) { toast.error("Indiquez un prix promotionnel."); return; }
      if (promoPrice >= normalPrice) { toast.error("Le prix promotionnel doit être inférieur au prix normal."); return; }
    }

    const prepTime = itemForm.prep_time_minutes.trim() === "" ? null : Number(itemForm.prep_time_minutes);
    if (prepTime !== null && (!Number.isFinite(prepTime) || prepTime < 1 || prepTime > 240)) {
      toast.error("Le temps de préparation doit être compris entre 1 et 240 minutes.");
      return;
    }

    setBusy(true);
    const payload = { name: itemForm.name.trim(), subtitle: itemForm.subtitle.trim() || null, description: itemForm.description.trim(), price: normalPrice, prep_time_minutes: prepTime, category_id: itemForm.category_id || null, sort_order: Number(itemForm.position) || 0, is_available: itemForm.available, is_daily_menu: itemForm.daily };
    let productId: string | null = editingItem?.id ?? null;
    if (editingItem) {
      const { error } = await supabase.from("restaurant_products").update(payload as any).eq("id", editingItem.id).eq("restaurant_id", rid);
      if (error) { setBusy(false); toast.error(error.message); return; }
    } else {
      const { data: inserted, error } = await supabase
        .from("restaurant_products")
        .insert({ restaurant_id: rid, slug: `${slugify(itemForm.name.trim())}-${Date.now().toString(36)}`, image_path: itemForm.image_path || null, ...payload } as any)
        .select("id")
        .single();
      if (error) { setBusy(false); toast.error(error.message); return; }
      productId = inserted.id;
    }

    if (productId) {
      try {
        await saveItemPromotion(productId, normalPrice);
      } catch (err) {
        setBusy(false);
        toast.error(err instanceof Error ? err.message : "Le plat a été enregistré, mais la promotion n'a pas pu être mise à jour.");
        return;
      }
    }

    setBusy(false);
    toast.success(editingItem ? "Plat mis à jour" : "Plat ajouté");
    setEditingItem(null); setItemDialogOpen(false); setItemPreview(null); setExistingPromotion(null);
    setItemForm(emptyItemForm({ categoryId: data?.categories[0]?.id, position: String((data?.rows.length ?? 0) + 1) }));
    await refresh();
  }

  async function saveRestaurant(): Promise<void> {
    const rid = restaurantId;
    if (!rid) return;
    setBusy(true);
    const { error } = await supabase.from("restaurants").update({ name: restaurantForm.name.trim(), logo_url: restaurantForm.logo_url.trim() || null, cover_url: restaurantForm.cover_url.trim() || null, address: restaurantForm.address.trim() || null, commune: restaurantForm.commune.trim() || null, city: restaurantForm.city.trim() || null, phone: restaurantForm.phone.trim() || null, whatsapp_phone: restaurantForm.whatsapp_phone.trim() || null, email: restaurantForm.email.trim() || null, is_public: restaurantForm.is_public, lat: restaurantForm.lat.trim() === "" ? null : Number(restaurantForm.lat), lng: restaurantForm.lng.trim() === "" ? null : Number(restaurantForm.lng) } as any).eq("id", rid);
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
    const maxBytes = field === "logo_url" ? MAX_LOGO_SIZE_BYTES : MAX_COVER_SIZE_BYTES;
    const maxLabel = field === "logo_url" ? "2 MB" : "5 MB";

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Format d'image non supporté.", { description: "Utilisez un fichier PNG, JPG ou WEBP." });
      return;
    }
    if (file.size > maxBytes) {
      toast.error("Image trop volumineuse.", { description: `Le ${label} doit peser moins de ${maxLabel}.` });
      return;
    }

    try {
      const { width, height } = await readImageDimensions(file);
      if (field === "logo_url") {
        if (width < MIN_LOGO_DIMENSION_PX || height < MIN_LOGO_DIMENSION_PX) {
          toast.error("Logo trop petit.", { description: `Recommandé : au moins ${MIN_LOGO_DIMENSION_PX} × ${MIN_LOGO_DIMENSION_PX} px.` });
          return;
        }
        if (Math.abs(width / height - 1) > 0.05) {
          toast.warning("Un logo carré (ratio 1:1) est recommandé pour un rendu optimal.");
        }
      } else if (width < RECOMMENDED_COVER_WIDTH_PX) {
        toast.warning(`Une largeur d'au moins ${RECOMMENDED_COVER_WIDTH_PX} px est recommandée pour la cover (idéalement 1920 × 900 px).`);
      }
    } catch {
      // Dimension probe failed (e.g. unreadable file) -- format/size checks
      // already ran, so let the upload proceed rather than blocking it.
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

  /** Quick show/hide from the list row -- toggles only `is_available`, no dialog, no navigation. A per-row id in `togglingItemIds` (not the global `busy` flag) blocks a double-click on that row without disabling the rest of the list. */
  async function toggleItemAvailability(row: DbMenuItem): Promise<void> {
    const rid = restaurantId;
    if (!rid || togglingItemIds.has(row.id)) return;
    setTogglingItemIds((current) => new Set(current).add(row.id));
    const nextAvailable = !row.available;
    const { error } = await supabase.from("restaurant_products").update({ is_available: nextAvailable } as any).eq("id", row.id).eq("restaurant_id", rid);
    setTogglingItemIds((current) => { const next = new Set(current); next.delete(row.id); return next; });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(nextAvailable ? "Plat affiché sur la vitrine" : "Plat masqué de la vitrine");
    await refresh();
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Toaster />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div><p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">{restaurant?.name ?? "Restaurant"}</p><h1 className="mt-2 font-display text-4xl font-semibold">Administration</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Gestion compacte de la carte, de la vitrine et des coordonnées.</p></div>
        <div className="flex flex-wrap items-center gap-2"><NotificationBell restaurantId={restaurantId} /><Button variant="outline" onClick={() => window.open(publicHref, "_blank", "noopener,noreferrer")}>Prévisualiser mon site</Button><Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}>Déconnexion</Button></div>
      </div>
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <AdminSidebar items={ADMIN_NAV_ITEMS} activeValue={tab} onSelect={setTab} pendingCount={ordersAlert.pendingCount} />
      <Tabs value={tab} onValueChange={setTab} className="min-w-0 space-y-6">
        <TabsList className="h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-transparent p-0 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden lg:hidden">
          {ADMIN_NAV_ITEMS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="relative shrink-0">
              {item.label}
              {item.value === "commandes" && ordersAlert.pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">{ordersAlert.pendingCount}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="accueil"><DashboardHome restaurantId={restaurantId} publicHref={publicHref} onNavigateTab={setTab} /></TabsContent>
        <TabsContent value="commandes"><OrdersPanel restaurantId={restaurantId} {...ordersAlert} /></TabsContent>
        <TabsContent value="clients"><CustomersPanel restaurantId={restaurantId} /></TabsContent>
        <TabsContent value="livreurs">{restaurantId && <DriversPanel restaurantId={restaurantId} />}</TabsContent>
        <TabsContent value="statistiques"><StatisticsPanel /></TabsContent>
        <TabsContent value="visiteurs"><VisitorsPanel /></TabsContent>
        <TabsContent value="finances"><FinancialPanel /></TabsContent>
        <TabsContent value="menu" className="space-y-6"><Card className="p-5"><MenuCategoriesPanel categories={data?.categories ?? []} counts={categoryCounts} busy={busy} onAdd={() => { setEditingCategory(null); setCategoryLabel(""); setCategoryDialogOpen(true); }} onEdit={(cat) => { setEditingCategory(cat); setCategoryLabel(cat.label); setCategoryDialogOpen(true); }} onDelete={setCategoryDelete} /></Card><Card className="p-5"><MenuItemsPanel rows={filteredRows} categories={data?.categories ?? []} busy={busy} togglingItemIds={togglingItemIds} search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} onAdd={() => { setEditingItem(null); setItemPreview(null); setExistingPromotion(null); setItemForm(emptyItemForm({ categoryId: data?.categories[0]?.id, position: String((data?.rows.length ?? 0) + 1) })); setItemDialogOpen(true); }} onEdit={(row) => { setEditingItem(row); setExistingPromotion(null); setItemForm({ name: row.name, subtitle: row.subtitle ?? "", description: row.description, price: row.price === null ? "" : String(row.price), prep_time_minutes: row.prep_time_minutes === null ? "" : String(row.prep_time_minutes), category_id: row.category_id ?? "", position: String(row.position), available: row.available, daily: row.daily, image_path: row.image_path ?? "", promotionEnabled: false, promotionalPrice: "" }); setItemDialogOpen(true); void loadItemPromotion(row.id, row.price); }} onDelete={setItemDelete} onToggleAvailability={(row) => void toggleItemAvailability(row)} /></Card></TabsContent>
        <TabsContent value="promotions" className="space-y-6">
          <div className="inline-flex rounded-full border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setPromotionsSubTab("produits")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${promotionsSubTab === "produits" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Promotions produit
            </button>
            <button
              type="button"
              onClick={() => setPromotionsSubTab("codes")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${promotionsSubTab === "codes" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Codes promo
            </button>
          </div>
          {promotionsSubTab === "produits" ? (
            <PromotionsPanel restaurantId={restaurantId} products={data?.rows ?? []} refreshSignal={promotionsRefreshSignal} />
          ) : (
            restaurantId && <PromoCodesPanel restaurantId={restaurantId} />
          )}
        </TabsContent>
        <TabsContent value="marketing">{restaurantId && <MarketingPanel restaurantId={restaurantId} products={data?.rows ?? []} />}</TabsContent>
        <TabsContent value="avis">{restaurantId && <ReviewsPanel restaurantId={restaurantId} />}</TabsContent>
        <TabsContent value="storefront" className="grid gap-6 lg:grid-cols-2"><Card className="space-y-5 p-5"><div><h2 className="font-display text-2xl font-semibold">Site vitrine</h2><p className="text-sm text-muted-foreground">Nom, visibilité publique, logo, cover et coordonnées.</p></div><div className="space-y-4"><Field label="Nom du restaurant"><Input value={restaurantForm.name} onChange={(e) => setRestaurantForm((c) => ({ ...c, name: e.target.value }))} /></Field><div className="grid gap-4 md:grid-cols-2"><AssetField label="Logo" helperText="PNG, JPG ou WEBP · recommandé 1000 × 1000 px · max 2 MB" preview={logoPreview} onPick={(file) => void uploadRestaurantAsset(file, "logo_url")} busy={busy} variant="logo" accept={ACCEPTED_IMAGE_TYPES.join(",")} /><AssetField label="Cover" helperText="JPG, PNG ou WEBP · recommandé 1920 × 900 px · max 5 MB" preview={coverPreview} onPick={(file) => void uploadRestaurantAsset(file, "cover_url")} busy={busy} variant="cover" accept={ACCEPTED_IMAGE_TYPES.join(",")} /></div><div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3"><Switch checked={restaurantForm.is_public} onCheckedChange={(checked) => setRestaurantForm((c) => ({ ...c, is_public: checked }))} /><div><p className="text-sm font-medium">Visibilité publique</p><p className="text-xs text-muted-foreground">Le site du tenant est exposé publiquement.</p></div></div></div><Button onClick={() => void saveRestaurant()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer la vitrine"}</Button></Card><Card className="space-y-4 p-5"><h3 className="font-semibold">Aperçu</h3><div className="overflow-hidden rounded-3xl border border-border"><div className="min-h-48 bg-muted" style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!coverPreview && <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">Fond neutre générique</div>}</div></div><div className="flex items-center gap-3 rounded-2xl border border-border p-4">{logoPreview ? <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded-2xl bg-white object-contain p-1 ring-1 ring-border" /> : <div className="h-14 w-14 rounded-2xl bg-muted" />}<div><p className="font-medium">{restaurantForm.name || restaurant?.name || "Restaurant"}</p><p className="text-sm text-muted-foreground">{`/r/${restaurant?.slug ?? "slug"}`}</p></div></div></Card></TabsContent>
        <TabsContent value="contact" className="grid gap-6 lg:grid-cols-2"><Card className="space-y-4 p-5"><div><h2 className="font-display text-2xl font-semibold">Coordonnées</h2><p className="text-sm text-muted-foreground">Adresse, téléphone, WhatsApp et email.</p></div><div className="grid gap-4 md:grid-cols-2"><Field label="Adresse"><Textarea value={restaurantForm.address} onChange={(e) => setRestaurantForm((c) => ({ ...c, address: e.target.value }))} /></Field><Field label="Commune"><Input value={restaurantForm.commune} onChange={(e) => setRestaurantForm((c) => ({ ...c, commune: e.target.value }))} /></Field><Field label="Ville"><Input value={restaurantForm.city} onChange={(e) => setRestaurantForm((c) => ({ ...c, city: e.target.value }))} /></Field><Field label="Téléphone"><Input value={restaurantForm.phone} onChange={(e) => setRestaurantForm((c) => ({ ...c, phone: e.target.value }))} /></Field><Field label="WhatsApp"><Input value={restaurantForm.whatsapp_phone} onChange={(e) => setRestaurantForm((c) => ({ ...c, whatsapp_phone: e.target.value }))} /></Field><Field label="Email"><Input type="email" value={restaurantForm.email} onChange={(e) => setRestaurantForm((c) => ({ ...c, email: e.target.value }))} /></Field></div><Button onClick={() => void saveRestaurant()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer les coordonnées"}</Button></Card><Card className="space-y-4 p-5"><div><h3 className="font-semibold">Localisation</h3><p className="text-sm text-muted-foreground">La carte est masquée si aucune adresse exploitable n’existe.</p></div>{mapPreview ? <iframe title="Prévisualisation Google Maps" src={mapPreview} className="h-80 w-full rounded-3xl border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="flex h-80 items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted-foreground">Aucune carte</div>}<div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground"><MapPin className="mb-2 h-4 w-4" />{mapsQuery(restaurantForm) || "Renseignez une adresse, une commune ou une ville."}</div><div className="space-y-2 rounded-2xl border border-border p-4"><p className="text-sm font-medium">Coordonnées GPS</p><p className="text-xs text-muted-foreground">Position exacte du restaurant, utilisée pour trouver automatiquement le livreur le plus proche. Sans elle, la recherche de livreur ne peut pas démarrer.</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Latitude"><Input type="number" step="any" placeholder="5.379" value={restaurantForm.lat} onChange={(e) => setRestaurantForm((c) => ({ ...c, lat: e.target.value }))} /></Field><Field label="Longitude"><Input type="number" step="any" placeholder="-3.988" value={restaurantForm.lng} onChange={(e) => setRestaurantForm((c) => ({ ...c, lng: e.target.value }))} /></Field></div><Button size="sm" variant="outline" onClick={() => void saveRestaurant()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer la position"}</Button></div></Card></TabsContent>
        <TabsContent value="disponibilite"><AvailabilityPanel restaurantId={restaurantId} timezone={restaurant?.timezone ?? "Africa/Abidjan"} /></TabsContent>
        <TabsContent value="settings" className="space-y-6"><Card className="p-5"><h2 className="font-display text-2xl font-semibold">Paramètres</h2><p className="mt-2 text-sm text-muted-foreground">Section réservée aux réglages complémentaires sans toucher à l’isolation multi-tenant.</p></Card><FulfillmentSettingsCard restaurantId={restaurantId} /><SubscriptionCard restaurantId={restaurantId} /><SecurityCard email={user.email ?? null} /></TabsContent>
      </Tabs>
      </div>
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingCategory ? "Modifier la catégorie" : "Ajouter une catégorie"}</DialogTitle><DialogDescription>Formulaire compact dédié aux catégories.</DialogDescription></DialogHeader><Field label="Nom"><Input value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} /></Field><DialogFooter><Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={busy}>Annuler</Button><Button onClick={() => void saveCategory()} disabled={busy}>{busy ? "Sauvegarde..." : "Enregistrer"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier le plat" : "Ajouter un plat"}</DialogTitle>
            <DialogDescription>Le même formulaire sert à la création et à l'édition.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <ItemPhotoField preview={itemPreview} onPick={(file) => void uploadItemImage(file)} busy={busy} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom"><Input value={itemForm.name} onChange={(e) => setItemForm((c) => ({ ...c, name: e.target.value }))} /></Field>
              <Field label="Sous-titre"><Input value={itemForm.subtitle} onChange={(e) => setItemForm((c) => ({ ...c, subtitle: e.target.value }))} /></Field>
            </div>

            <Field label="Description"><Textarea rows={3} value={itemForm.description} onChange={(e) => setItemForm((c) => ({ ...c, description: e.target.value }))} /></Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prix (FCFA)"><Input type="number" min={0} value={itemForm.price} onChange={(e) => setItemForm((c) => ({ ...c, price: e.target.value }))} /></Field>
              <Field label="Temps de préparation">
                <Input
                  type="number"
                  min={1}
                  max={240}
                  placeholder="Ex. 20"
                  value={itemForm.prep_time_minutes}
                  onChange={(e) => setItemForm((c) => ({ ...c, prep_time_minutes: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">Temps moyen nécessaire pour préparer ce plat (minutes).</p>
              </Field>
            </div>

            <div className="space-y-3 rounded-2xl border border-border p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Promotion</span>
                <Switch
                  checked={itemForm.promotionEnabled}
                  disabled={Boolean(existingPromotion) && existingPromotion?.type !== "fixed_amount"}
                  onCheckedChange={(v) => setItemForm((c) => ({ ...c, promotionEnabled: v }))}
                />
              </label>
              {existingPromotion && existingPromotion.type !== "fixed_amount" ? (
                <p className="text-xs text-muted-foreground">
                  Une promotion ({existingPromotion.type === "percentage" ? `-${existingPromotion.value}%` : "livraison gratuite"}) est déjà active sur ce plat. Gérez-la depuis l'onglet Promotions.
                </p>
              ) : itemForm.promotionEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Prix normal"><Input type="number" value={itemForm.price} disabled className="bg-muted" /></Field>
                  <Field label="Prix promotionnel"><Input type="number" min={0} value={itemForm.promotionalPrice} onChange={(e) => setItemForm((c) => ({ ...c, promotionalPrice: e.target.value }))} /></Field>
                  {itemForm.price.trim() !== "" && itemForm.promotionalPrice.trim() !== "" && Number(itemForm.promotionalPrice) > 0 && Number(itemForm.promotionalPrice) < Number(itemForm.price) && (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Aperçu client : <span className="line-through">{Number(itemForm.price).toLocaleString("fr-FR")} FCFA</span>{" "}
                      <span className="font-semibold text-primary">{Number(itemForm.promotionalPrice).toLocaleString("fr-FR")} FCFA</span>
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Catégorie">
                <select value={itemForm.category_id} onChange={(e) => setItemForm((c) => ({ ...c, category_id: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Sans catégorie</option>
                  {data?.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Ordre"><Input type="number" value={itemForm.position} onChange={(e) => setItemForm((c) => ({ ...c, position: e.target.value }))} /></Field>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={itemForm.available} onCheckedChange={(v) => setItemForm((c) => ({ ...c, available: v }))} /> Disponible</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={itemForm.daily} onCheckedChange={(v) => setItemForm((c) => ({ ...c, daily: v }))} /> Menu du jour</label>
            </div>

            {restaurantId && <OptionGroupsManager restaurantId={restaurantId} productId={editingItem?.id ?? null} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)} disabled={busy}>Annuler</Button>
            <Button onClick={() => void saveItem()} disabled={busy}>{busy ? "Sauvegarde..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(categoryDelete)} onOpenChange={(open) => !open && setCategoryDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle><AlertDialogDescription>Cette action est définitive.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => void removeCategory()} disabled={busy}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(itemDelete)} onOpenChange={(open) => !open && setItemDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce plat ?</AlertDialogTitle><AlertDialogDescription>Cette action est définitive.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => void removeItem()} disabled={busy}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}
function SimpleAccess({ title, message, email, publicHref, onLogout }: { title: string; message: string; email: string; publicHref?: string; onLogout: () => Promise<void> }) {
  return (<main className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="font-display text-3xl font-semibold">{title}</h1><p className="mt-3 text-sm text-muted-foreground">{message}</p><p className="mt-2 text-xs text-muted-foreground">{email}</p><div className="mt-6 flex flex-wrap justify-center gap-2">{publicHref ? <a href={publicHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm">Voir le site</a> : null}<Button variant="outline" onClick={() => void onLogout()}>Se déconnecter</Button></div><Toaster /></main>);
}

/** Desktop-only left sidebar mirroring the mobile tab bar's items -- both are driven by ADMIN_NAV_ITEMS and the same `tab` state, so they never drift apart. Mobile keeps its existing horizontal TabsList untouched (hidden here via lg:block). */
function AdminSidebar({ items, activeValue, onSelect, pendingCount }: { items: readonly { value: string; label: string }[]; activeValue: string; onSelect: (value: string) => void; pendingCount: number }) {
  return (
    <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
      <nav className="space-y-1 rounded-3xl border border-border bg-card p-3 shadow-sm">
        {items.map((item) => {
          const active = activeValue === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onSelect(item.value)}
              className={`flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted"
              }`}
            >
              <span>{item.label}</span>
              {item.value === "commandes" && pendingCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function AssetField({ label, helperText, preview, onPick, busy, variant = "cover", accept = "image/*" }: { label: string; helperText?: string; preview: string | null; onPick: (file: File) => void; busy: boolean; variant?: "logo" | "cover"; accept?: string }) {
  const isLogo = variant === "logo";
  return (
    <div className={`space-y-2 ${isLogo ? "" : "md:col-span-2"}`}>
      <Label>{label}</Label>
      <div className="rounded-2xl border border-dashed border-border p-4">
        {isLogo ? (
          <div className="mx-auto mb-3 flex h-40 w-40 items-center justify-center rounded-2xl bg-white p-2 ring-1 ring-border">
            {preview ? <img src={preview} alt={label} className="h-full w-full object-contain" /> : <div className="h-full w-full rounded-xl bg-muted" />}
          </div>
        ) : (
          <div className="mb-3 aspect-[16/7.5] max-h-[360px] w-full overflow-hidden rounded-2xl bg-muted">
            {preview && <img src={preview} alt={label} className="h-full w-full object-cover" />}
          </div>
        )}
        <Input type="file" accept={accept} disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) onPick(file); e.target.value = ""; }} />
        {helperText && <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>}
      </div>
    </div>
  );
}

/** Large, modern photo dropzone for the item editor -- distinct from AssetField (used for the small logo/cover thumbnails) so enlarging this one doesn't affect those. */
function ItemPhotoField({ preview, onPick, busy }: { preview: string | null; onPick: (file: File) => void; busy: boolean }) {
  const inputId = "item-photo-input";
  return (
    <div className="space-y-2">
      <Label>Photo</Label>
      <label
        htmlFor={inputId}
        className="group relative flex h-[280px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-muted transition-colors hover:border-primary sm:h-[340px] lg:h-[380px]"
      >
        {preview ? (
          <>
            <img src={preview} alt="Photo du plat" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 py-4 text-sm font-semibold text-white">
              <ImagePlus className="h-4 w-4" /> Modifier la photo
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <ImagePlus className="h-10 w-10" />
            Ajouter une photo
          </span>
        )}
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function MenuCategoriesPanel({ categories, counts, busy, onAdd, onEdit, onDelete }: { categories: Cat[]; counts: Map<string | null, number>; busy: boolean; onAdd: () => void; onEdit: (cat: Cat) => void; onDelete: (cat: Cat) => void; }) {
  return (<div><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">Catégories</h2><p className="text-sm text-muted-foreground">Vue compacte avec ajout, renommage et suppression.</p></div><Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Ajouter une catégorie</Button></div><div className="mt-4 space-y-2">{categories.map((cat) => (<div key={cat.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3"><div><p className="font-medium">{cat.label}</p><p className="text-xs text-muted-foreground">{counts.get(cat.id) ?? 0} plat(s)</p></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" disabled={busy} onClick={() => onEdit(cat)}><PencilLine className="mr-2 h-4 w-4" />Modifier</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => onDelete(cat)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button></div></div>))}</div></div>);
}

function MenuItemsPanel({ rows, categories, busy, togglingItemIds, search, setSearch, categoryFilter, setCategoryFilter, onAdd, onEdit, onDelete, onToggleAvailability }: { rows: DbMenuItem[]; categories: Cat[]; busy: boolean; togglingItemIds: Set<string>; search: string; setSearch: (v: string) => void; categoryFilter: string; setCategoryFilter: (v: string) => void; onAdd: () => void; onEdit: (row: DbMenuItem) => void; onDelete: (row: DbMenuItem) => void; onToggleAvailability: (row: DbMenuItem) => void; }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Plats</h2>
          <p className="text-sm text-muted-foreground">Liste compacte avec miniature, prix, catégorie et statut.</p>
        </div>
        <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Ajouter un plat</Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un plat..." className="pl-9" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">Toutes les catégories</option>
          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
        </select>
      </div>
      <div className="mt-4 space-y-1.5">
        {rows.map((row) => {
          const cat = categories.find((c) => c.id === row.category_id)?.label ?? "Sans catégorie";
          const src = row.image_path ? supabase.storage.from(MENU_BUCKET).getPublicUrl(row.image_path).data.publicUrl : null;
          const toggling = togglingItemIds.has(row.id);
          return (
            <div key={row.id} className="flex min-h-[80px] items-center gap-2.5 rounded-2xl border border-border bg-background px-3 py-2.5 sm:min-h-[92px] sm:gap-4 sm:px-4 sm:py-3">
              <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted sm:h-[72px] sm:w-[72px]">
                {src ? <img src={src} alt={row.name} className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground/50" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-semibold">{row.name}</p>
                  {row.daily ? <Badge variant="secondary" className="shrink-0">Menu du jour</Badge> : null}
                  <Badge variant={row.available ? "default" : "outline"} className="shrink-0">{row.available ? "Disponible" : "Indisponible"}</Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {cat} · {row.price === null ? "Prix sur demande" : `${row.price.toLocaleString("fr-FR")} FCFA`} · Ordre {row.position}
                </p>
              </div>
              <label
                className="flex shrink-0 flex-col items-center gap-1 text-[0.65rem] font-medium text-muted-foreground"
                title={row.available ? "Masquer ce plat" : "Afficher ce plat"}
              >
                <Switch checked={row.available} disabled={busy || toggling} onCheckedChange={() => onToggleAvailability(row)} aria-label={row.available ? "Masquer ce plat" : "Afficher ce plat"} />
                {row.available ? "Afficher" : "Masqué"}
              </label>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" disabled={busy} onClick={() => onEdit(row)} title="Modifier" aria-label="Modifier">
                  <PencilLine className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={busy} onClick={() => onDelete(row)} title="Supprimer" aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}









