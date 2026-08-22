import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_THEME } from "@/lib/theme";
import { createTenant, fetchTenants, type RestaurantStatus, type TenantRow } from "@/lib/superAdminTenants";

const STATUSES = ["trial", "active", "suspended", "archived"] as const;
const STATUS_LABELS: Record<RestaurantStatus, string> = {
  trial: "Essai",
  active: "Actif",
  suspended: "Suspendu",
  archived: "Archivé",
};
const STATUS_BADGE: Record<RestaurantStatus, string> = {
  trial: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  suspended: "bg-red-100 text-red-800",
  archived: "bg-slate-200 text-slate-600",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export const Route = createFileRoute("/super-admin/")({
  ssr: false,
  component: SuperAdminIndexPage,
});

function SuperAdminIndexPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setTenants(await fetchTenants());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <OverviewBlock tenants={tenants} loading={loading} onStatusChanged={load} />
      <CreateTenantForm onCreated={load} />
      <UsersBlock tenants={tenants} />
      <ThemesBlock />
      <PlatformSettingsBlock />
    </>
  );
}

function OverviewBlock({
  tenants,
  loading,
  onStatusChanged,
}: {
  tenants: TenantRow[];
  loading: boolean;
  onStatusChanged: () => void;
}) {
  const [status, setStatus] = useState<RestaurantStatus | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = tenants;
    if (status !== "all") list = list.filter((t) => t.status === status);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => [t.name, t.slug, t.owner_email, t.owner_name].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [tenants, status, query]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: tenants.length,
      active: tenants.filter((t) => t.status === "active").length,
      suspended: tenants.filter((t) => t.status === "suspended").length,
      recent: tenants.filter((t) => new Date(t.created_at).getTime() >= weekAgo).length,
    };
  }, [tenants]);

  async function toggleStatus(tenant: TenantRow) {
    const nextStatus: RestaurantStatus = tenant.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("restaurants").update({ status: nextStatus }).eq("id", tenant.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(nextStatus === "suspended" ? "Tenant désactivé" : "Tenant activé");
    onStatusChanged();
  }

  return (
    <section id="overview" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Vue d&apos;ensemble</p>
          <h2 className="mt-2 text-3xl font-semibold">Pilotage du SaaS</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total tenants" value={stats.total} />
          <StatCard label="Tenants actifs" value={stats.active} />
          <StatCard label="Tenants suspendus" value={stats.suspended} />
          <StatCard label="Nouveaux (7j)" value={stats.recent} />
        </div>
      </div>

      <div id="tenants" className="mt-8">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un tenant..." />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RestaurantStatus | "all")}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">Tous les status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Administrateur</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Thème</th>
                  <th className="px-4 py-3">Créé le</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={7}>
                      Chargement...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={7}>
                      Aucun tenant.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{tenant.name}</td>
                      <td className="px-4 py-3 text-slate-600">{tenant.owner_name ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{tenant.owner_email ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${STATUS_BADGE[tenant.status]}`}>
                          {STATUS_LABELS[tenant.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-slate-300"
                          style={{ backgroundColor: tenant.primary_color ?? DEFAULT_THEME.primary_color ?? undefined }}
                          title={tenant.primary_color ? "Thème personnalisé" : "Thème par défaut"}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{new Date(tenant.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link to="/super-admin/restaurants/$restaurantId" params={{ restaurantId: tenant.id }} className="text-cyan-700 underline">
                            Voir
                          </Link>
                          <button onClick={() => void toggleStatus(tenant)} className="text-cyan-700 underline">
                            {tenant.status === "suspended" ? "Activer" : "Désactiver"}
                          </button>
                          <a href={`/r/${tenant.slug}`} target="_blank" rel="noreferrer" className="text-cyan-700 underline">
                            Ouvrir
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
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

type ThemeFormState = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  font_family: string;
  border_radius: string;
};

function emptyThemeForm(): ThemeFormState {
  return {
    primary_color: "",
    secondary_color: "",
    accent_color: "",
    background_color: "",
    surface_color: "",
    text_color: "",
    font_family: "",
    border_radius: "",
  };
}

function CreateTenantForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [restaurantEmail, setRestaurantEmail] = useState("");
  const [address, setAddress] = useState("");
  const [commune, setCommune] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<RestaurantStatus>("active");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [theme, setTheme] = useState<ThemeFormState>(emptyThemeForm());
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<{ name: string; slug: string; email: string } | null>(null);

  function reset() {
    setName("");
    setSlug("");
    setPhone("");
    setWhatsappPhone("");
    setRestaurantEmail("");
    setAddress("");
    setCommune("");
    setCity("");
    setStatus("active");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setTheme(emptyThemeForm());
  }

  async function submit() {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim() || slugify(trimmedName);
    if (!trimmedName || !trimmedSlug) {
      toast.error("Nom et slug du restaurant sont requis.");
      return;
    }
    if (!adminEmail.trim() || !adminPassword) {
      toast.error("E-mail et mot de passe de l'administrateur sont requis.");
      return;
    }
    setSaving(true);
    try {
      const result = await createTenant({
        restaurant: {
          name: trimmedName,
          slug: trimmedSlug,
          phone: phone || null,
          whatsapp_phone: whatsappPhone || null,
          email: restaurantEmail || null,
          address: address || null,
          commune: commune || null,
          city: city || null,
          status,
        },
        admin: { name: adminName || null, email: adminEmail.trim(), password: adminPassword },
        theme: {
          primary_color: theme.primary_color || null,
          secondary_color: theme.secondary_color || null,
          accent_color: theme.accent_color || null,
          background_color: theme.background_color || null,
          surface_color: theme.surface_color || null,
          text_color: theme.text_color || null,
          font_family: theme.font_family || null,
          border_radius: theme.border_radius || null,
        },
      });
      toast.success("Tenant créé avec succès");
      setConfirmation({ name: result.name, slug: result.slug, email: result.admin_email });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer le tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="create-tenant" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Tenants</p>
          <h2 className="mt-2 text-2xl font-semibold">Créer un nouveau tenant</h2>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>{open ? "Fermer" : "Ouvrir le formulaire"}</Button>
      </div>

      {confirmation && (
        <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-900">Tenant créé : {confirmation.name}</p>
          <p className="mt-1 text-sm text-emerald-800">E-mail de connexion : {confirmation.email}</p>
          <p className="mt-1 text-xs text-emerald-700">Le mot de passe n&apos;est ni affiché ni enregistré à nouveau -- il a été défini une seule fois lors de la création.</p>
          <div className="mt-3 flex gap-3">
            <a href={`/r/${confirmation.slug}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">Ouvrir l&apos;espace tenant</Button>
            </a>
            <Button size="sm" variant="ghost" onClick={() => setConfirmation(null)}>Fermer</Button>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Restaurant</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom officiel"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Slug (URL)"><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto si vide" /></Field>
              <Field label="Téléphone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="WhatsApp"><Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} /></Field>
              <Field label="Email restaurant"><Input type="email" value={restaurantEmail} onChange={(e) => setRestaurantEmail(e.target.value)} /></Field>
              <Field label="Ville"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              <Field label="Commune"><Input value={commune} onChange={(e) => setCommune(e.target.value)} /></Field>
              <Field label="Statut initial">
                <select value={status} onChange={(e) => setStatus(e.target.value as RestaurantStatus)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2"><Field label="Adresse"><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></Field></div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Administrateur (tenant)</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom du responsable"><Input value={adminName} onChange={(e) => setAdminName(e.target.value)} /></Field>
              <Field label="Email de connexion"><Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></Field>
              <Field label="Mot de passe initial"><Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="8+ caractères, lettres et chiffres" /></Field>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Thème officiel</p>
            <p className="mb-3 text-xs text-slate-500">Laissez vide pour utiliser le thème officiel par défaut de la plateforme.</p>
            <div className="grid gap-4 md:grid-cols-3">
              <ColorField label="Couleur principale" value={theme.primary_color} onChange={(v) => setTheme((t) => ({ ...t, primary_color: v }))} />
              <ColorField label="Couleur secondaire" value={theme.secondary_color} onChange={(v) => setTheme((t) => ({ ...t, secondary_color: v }))} />
              <ColorField label="Couleur accent" value={theme.accent_color} onChange={(v) => setTheme((t) => ({ ...t, accent_color: v }))} />
              <ColorField label="Couleur de fond" value={theme.background_color} onChange={(v) => setTheme((t) => ({ ...t, background_color: v }))} />
              <ColorField label="Couleur des cartes" value={theme.surface_color} onChange={(v) => setTheme((t) => ({ ...t, surface_color: v }))} />
              <ColorField label="Couleur du texte" value={theme.text_color} onChange={(v) => setTheme((t) => ({ ...t, text_color: v }))} />
              <Field label="Police officielle"><Input value={theme.font_family} onChange={(e) => setTheme((t) => ({ ...t, font_family: e.target.value }))} placeholder="ex: Inter, sans-serif" /></Field>
              <Field label="Arrondi des bords"><Input value={theme.border_radius} onChange={(e) => setTheme((t) => ({ ...t, border_radius: e.target.value }))} placeholder="ex: 0.75rem" /></Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void submit()} disabled={saving}>{saving ? "Création..." : "Créer le tenant"}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          defaultValue="#c2410c"
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white"
          aria-label={`Sélecteur ${label}`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Thème par défaut" />
      </div>
    </label>
  );
}

function UsersBlock({ tenants }: { tenants: TenantRow[] }) {
  return (
    <section id="users" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Utilisateurs</p>
      <h2 className="mt-2 text-2xl font-semibold">Administrateurs des tenants</h2>
      <p className="mt-1 text-sm text-slate-500">Vue en lecture seule des propriétaires de chaque restaurant.</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Restaurant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">{t.owner_name ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{t.owner_email ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{t.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ThemesBlock() {
  const swatches: { label: string; value: string | null }[] = [
    { label: "Principale", value: DEFAULT_THEME.primary_color },
    { label: "Secondaire", value: DEFAULT_THEME.secondary_color },
    { label: "Accent", value: DEFAULT_THEME.accent_color },
    { label: "Fond", value: DEFAULT_THEME.background_color },
    { label: "Cartes", value: DEFAULT_THEME.surface_color },
    { label: "Texte", value: DEFAULT_THEME.text_color },
  ];
  return (
    <section id="themes" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Thèmes</p>
      <h2 className="mt-2 text-2xl font-semibold">Thème officiel par défaut</h2>
      <p className="mt-1 text-sm text-slate-500">
        Appliqué automatiquement à tout nouveau tenant qui ne personnalise pas sa palette. Pour modifier le thème d&apos;un
        restaurant existant, ouvrez sa fiche depuis l&apos;onglet Tenants.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        {swatches.map((s) => (
          <div key={s.label} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <span className="h-5 w-5 rounded-full border border-slate-300" style={{ backgroundColor: s.value ?? undefined }} />
            <span className="text-sm text-slate-700">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformSettingsBlock() {
  return (
    <section id="platform-settings" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Paramètres plateforme</p>
      <h2 className="mt-2 text-2xl font-semibold">Valeurs par défaut</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Statut initial des nouveaux tenants</dt>
          <dd className="mt-1 text-sm font-medium">Actif</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Devise par défaut</dt>
          <dd className="mt-1 text-sm font-medium">XOF</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Fuseau horaire par défaut</dt>
          <dd className="mt-1 text-sm font-medium">Africa/Abidjan</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Seul rôle habilité à créer un tenant</dt>
          <dd className="mt-1 text-sm font-medium">Super Admin</dd>
        </div>
      </dl>
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
