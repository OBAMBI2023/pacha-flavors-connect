import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminMenuData, MENU_BUCKET, type DbMenuItem } from "@/lib/menu-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const TITLE = "Administration de la carte";
const DESCRIPTION =
  "Gerez la carte de votre restaurant : photos des plats, prix, categories et menu du jour.";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, canManageMenu, restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useAdminMenuData(restaurantId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-menu-data", restaurantId] });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) return <p className="p-10 text-sm text-muted-foreground">Chargement...</p>;
  if (!user) return null;

  if (!restaurantId) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">Accès réservé</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Votre compte ({user.email}) n&apos;est pas encore rattaché à un restaurant.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            Se déconnecter
          </Button>
        </div>
        <Toaster />
      </main>
    );
  }

  if (!canManageMenu) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">Accès réservé</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Votre rôle ne permet pas de modifier le menu. Seuls owner et manager peuvent gérer les
          catégories et les plats.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm">
            Voir le site
          </Link>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            Se déconnecter
          </Button>
        </div>
        <Toaster />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
            {data?.restaurant?.name ?? "..."}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Gestion de la carte</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm">
            Voir le site
          </Link>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            Déconnexion
          </Button>
        </div>
      </div>

      <CategoriesPanel restaurantId={restaurantId} categories={data?.categories ?? []} onChange={refresh} />
      <ItemsPanel restaurantId={restaurantId} rows={data?.rows ?? []} categories={data?.categories ?? []} onChange={refresh} />
    </main>
  );
}

type Cat = { id: string; label: string; position: number };

function CategoriesPanel({ restaurantId, categories, onChange }: { restaurantId: string; categories: Cat[]; onChange: () => void; }) {
  const [label, setLabel] = useState("");

  async function addCategory() {
    if (!label.trim()) return;
    const { error } = await supabase.from("restaurant_categories").insert({
      restaurant_id: restaurantId,
      name: label.trim(),
      slug: `${slugify(label.trim())}-${Date.now().toString(36)}`,
      sort_order: categories.length + 1,
    });
    if (error) toast.error(error.message);
    else { toast.success("Catégorie ajoutée"); setLabel(""); onChange(); }
  }

  async function rename(cat: Cat, value: string) {
    const { error } = await supabase.from("restaurant_categories").update({ name: value }).eq("id", cat.id).eq("restaurant_id", restaurantId);
    if (error) toast.error(error.message); else onChange();
  }

  async function removeCategory(cat: Cat) {
    const { error } = await supabase.from("restaurant_categories").delete().eq("id", cat.id).eq("restaurant_id", restaurantId);
    if (error) toast.error(error.message); else { toast.success("Catégorie supprimée"); onChange(); }
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-2xl font-semibold">Catégories</h2>
      <div className="mt-4 space-y-3">
        {categories.map((cat) => (
          <div key={cat.id} className="flex flex-wrap items-center gap-2">
            <Input defaultValue={cat.label} onBlur={(e) => { if (e.target.value !== cat.label) rename(cat, e.target.value); }} className="max-w-xs" />
            <Button variant="ghost" size="sm" onClick={() => removeCategory(cat)}>Supprimer</Button>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Input placeholder="Nouvelle catégorie" value={label} onChange={(e) => setLabel(e.target.value)} className="max-w-xs" />
        <Button onClick={addCategory}>Ajouter</Button>
      </div>
    </section>
  );
}

function ItemsPanel({ restaurantId, rows, categories, onChange }: { restaurantId: string; rows: DbMenuItem[]; categories: Cat[]; onChange: () => void; }) {
  async function addItem() {
    const name = "Nouveau plat";
    const { error } = await supabase.from("restaurant_products").insert({
      restaurant_id: restaurantId,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      description: "",
      category_id: categories[0]?.id ?? null,
      sort_order: rows.length + 1,
      is_available: true,
      is_daily_menu: false,
    });
    if (error) toast.error(error.message); else { toast.success("Plat ajouté"); onChange(); }
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Plats</h2>
        <Button onClick={addItem}>Ajouter un plat</Button>
      </div>
      <div className="mt-6 space-y-6">
        {rows.map((row) => <ItemEditor key={row.id} restaurantId={restaurantId} row={row} categories={categories} onChange={onChange} />)}
      </div>
    </section>
  );
}

function ItemEditor({ restaurantId, row, categories, onChange }: { restaurantId: string; row: DbMenuItem; categories: Cat[]; onChange: () => void; }) {
  const [form, setForm] = useState({
    name: row.name,
    subtitle: row.subtitle ?? "",
    description: row.description,
    price: row.price === null ? "" : String(row.price),
    category_id: row.category_id ?? "",
    available: row.available,
    daily: row.daily,
    position: row.position,
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!row.image_path) { setPreview(null); return; }
    setPreview(supabase.storage.from(MENU_BUCKET).getPublicUrl(row.image_path).data.publicUrl);
  }, [row.image_path]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("restaurant_products").update({
      name: form.name,
      subtitle: form.subtitle || null,
      description: form.description,
      price: form.price === "" ? null : Number(form.price),
      category_id: form.category_id || null,
      is_available: form.available,
      is_daily_menu: form.daily,
      sort_order: Number(form.position) || 0,
    }).eq("id", row.id).eq("restaurant_id", restaurantId);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Plat mis à jour"); onChange(); }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${row.slug}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(MENU_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { error } = await supabase.from("restaurant_products").update({ image_path: path }).eq("id", row.id).eq("restaurant_id", restaurantId);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Photo mise à jour"); onChange(); }
  }

  async function removeItem() {
    const { error } = await supabase.from("restaurant_products").delete().eq("id", row.id).eq("restaurant_id", restaurantId);
    if (error) toast.error(error.message); else { toast.success("Plat supprimé"); onChange(); }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Sous-titre</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="space-y-2"><Label>Prix (FCFA) - vide = prix sur demande</Label><Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Sans catégorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-2"><Label>Ordre d&apos;affichage</Label><Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} /></div>
        <div className="flex items-end gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} /> Disponible</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.daily} onCheckedChange={(v) => setForm({ ...form, daily: v })} /> Menu du jour</label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Photo du plat</Label>
          <div className="flex flex-wrap items-center gap-4">
            {preview && <img src={preview} alt={form.name} className="h-20 w-20 rounded-lg object-cover" />}
            <Input type="file" accept="image/*" className="max-w-xs" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); }} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={save} disabled={busy}>Enregistrer</Button>
        <Button variant="ghost" onClick={removeItem} disabled={busy}>Supprimer</Button>
      </div>
    </div>
  );
}
