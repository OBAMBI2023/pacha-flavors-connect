import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const STATUSES = ["trial", "active", "suspended", "archived"] as const;

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  address: string | null;
  commune: string | null;
  city: string | null;
  status: (typeof STATUSES)[number];
  trial_ends_at: string | null;
  is_public: boolean;
  created_at: string;
};

export const Route = createFileRoute("/super-admin/")({
  ssr: false,
  component: SuperAdminIndexPage,
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function SuperAdminIndexPage() {
  return (
    <>
      <OverviewBlock />
      <RestaurantManager />
    </>
  );
}

function OverviewBlock() {
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [status, setStatus] = useState<(typeof STATUSES)[number] | "all">("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    let request = supabase
      .from("restaurants")
      .select("id,name,slug,phone,whatsapp_phone,email,address,commune,city,status,trial_ends_at,is_public,created_at")
      .order("created_at", { ascending: false });
    if (status !== "all") request = request.eq("status", status);
    const { data, error } = await request;
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRestaurants((data ?? []) as RestaurantRow[]);
  }

  useEffect(() => { void load(); }, [status]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) => [r.name, r.slug, r.email, r.city, r.commune].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [query, restaurants]);

  const stats = useMemo(() => ({
    total: restaurants.length,
    active: restaurants.filter((r) => r.status === "active").length,
    trial: restaurants.filter((r) => r.status === "trial").length,
    suspended: restaurants.filter((r) => r.status === "suspended").length,
  }), [restaurants]);

  return (
    <section id="overview" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Vue d&apos;ensemble</p>
          <h2 className="mt-2 text-3xl font-semibold">Pilotage du SaaS</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Restaurants" value={stats.total} />
          <StatCard label="Actifs" value={stats.active} />
          <StatCard label="Essais" value={stats.trial} />
          <StatCard label="Suspendus" value={stats.suspended} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un restaurant..." />
        <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number] | "all")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="all">Tous les status</option>
          {STATUSES.map((value) => <option key={value} value={value}>`n              {value}`n            </option>)}
        </select>
      </div>

      <div id="restaurants" className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trial ends</th>
                <th className="px-4 py-3">Public</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {busy && <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>Chargement...</td></tr>}
              {!busy && filtered.map((restaurant) => (
                <tr key={restaurant.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{restaurant.name}</td>
                  <td className="px-4 py-3 text-slate-600">{restaurant.slug}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide">{restaurant.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{restaurant.trial_ends_at ? new Date(restaurant.trial_ends_at).toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{restaurant.is_public ? "Oui" : "Non"}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(restaurant.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><Link to="/super-admin/restaurants/$restaurantId" params={{ restaurantId: restaurant.id }} className="text-cyan-700 underline">Ouvrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RestaurantManager() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [commune, setCommune] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("trial");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  async function createRestaurant() {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim() || slugify(trimmedName);
    if (!trimmedName || !trimmedSlug) {
      toast.error("Nom et slug sont requis");
      return;
    }
    setSaving(true);
    // restaurant_settings is initialized automatically by the
    // restaurants_create_settings DB trigger (create_restaurant_settings_default)
    // in the same insert -- no separate client-side write needed or wanted.
    const { error } = await supabase.from("restaurants").insert({
      name: trimmedName,
      slug: trimmedSlug,
      phone: phone || null,
      whatsapp_phone: whatsappPhone || null,
      email: email || null,
      address: address || null,
      commune: commune || null,
      city: city || null,
      status,
      trial_ends_at: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
      is_public: isPublic,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Restaurant cree");
    setOpen(false);
    setName("");
    setSlug("");
    setPhone("");
    setWhatsappPhone("");
    setEmail("");
    setAddress("");
    setCommune("");
    setCity("");
    setStatus("trial");
    setTrialEndsAt("");
    setIsPublic(false);
    window.location.hash = "#overview";
  }

  return (
    <section id="settings" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Parametres</p>
          <h2 className="mt-2 text-2xl font-semibold">Creer un restaurant</h2>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>{open ? "Fermer" : "Ouvrir le formulaire"}</Button>
      </div>

      {open && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Slug"><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto si vide" /></Field>
            <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="WhatsApp"><Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            <Field label="Commune"><Input value={commune} onChange={(e) => setCommune(e.target.value)} /></Field>
            <Field label="Trial ends at"><Input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Address"><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></Field></div>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <div>
                <p className="text-sm font-medium">Visible au public</p>
                <p className="text-xs text-slate-500">Active la page publique du restaurant.</p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={createRestaurant} disabled={saving}>{saving ? "Creation..." : "Creer le restaurant"}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}



