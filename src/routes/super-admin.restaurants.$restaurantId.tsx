import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCodeCard } from "@/components/admin/settings/QrCodeCard";
import { StatCard } from "@/components/admin/stats/StatCard";
import { formatMoney } from "@/lib/currency";
import { fetchDashboardStats, type DashboardStats } from "@/lib/orders-db";
import { fetchTenantQrStats, type TenantQrStats } from "@/lib/visitors-db";
import {
  fetchPlans,
  fetchRestaurantSubscription,
  resetTenantPassword,
  setTenantPlan,
  type Plan,
  type RestaurantSubscription,
} from "@/lib/superAdminTenants";

const STATUSES = ["trial", "active", "suspended", "archived"] as const;
const ROLES = ["owner", "manager", "staff"] as const;
const MEMBER_STATUSES = ["active", "invited", "disabled"] as const;

const ROLE_DESCRIPTIONS: Record<(typeof ROLES)[number], string> = {
  owner: "Accès complet à ce restaurant : commandes, menu, stock, encaissements, finances, paramètres, membres.",
  manager: "Mêmes accès opérationnels que le propriétaire (commandes, menu, stock, encaissements), sans gestion des membres.",
  staff: "Accès limité aux commandes et à la préparation -- pas d'accès aux finances ni aux paramètres du restaurant.",
};

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  address: string | null;
  commune: string | null;
  city: string | null;
  country_code: string;
  lat: number | null;
  lng: number | null;
  currency: string;
  timezone: string;
  status: (typeof STATUSES)[number];
  trial_ends_at: string | null;
  is_public: boolean;
  created_at: string;
};

type Membership = {
  id: string;
  user_id: string;
  restaurant_id: string;
  role: (typeof ROLES)[number];
  status: (typeof MEMBER_STATUSES)[number] | null;
  email: string | null;
};

type AuditLogRow = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export const Route = createFileRoute("/super-admin/restaurants/$restaurantId")({
  ssr: false,
  component: RestaurantDetailPage,
});

function RestaurantDetailPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { restaurantId } = Route.useParams();
  const [allowed, setAllowed] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<(typeof ROLES)[number]>("manager");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, navigate, user]);

  async function loadMembers() {
    const { data, error } = await supabase.rpc("super_admin_list_restaurant_members", { _restaurant_id: restaurantId });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMembers(
      (data ?? []).map((item) => ({
        id: `${item.user_id}:${item.role}`,
        user_id: item.user_id,
        restaurant_id: item.restaurant_id,
        role: item.role,
        status: item.status as (typeof MEMBER_STATUSES)[number] | null,
        email: item.email,
      })),
    );
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("id,is_super_admin").eq("id", user.id).maybeSingle();
      if (!profile?.is_super_admin) {
        if (!cancelled) setAllowed(false);
        return;
      }
      const [{ data: restaurantData }] = await Promise.all([
        supabase
          .from("restaurants")
          .select("id,name,slug,logo_url,cover_url,phone,whatsapp_phone,email,address,commune,city,country_code,lat,lng,currency,timezone,status,trial_ends_at,is_public,created_at")
          .eq("id", restaurantId)
          .maybeSingle(),
        loadMembers(),
      ]);
      if (cancelled) return;
      setAllowed(true);
      setRestaurant((restaurantData as Restaurant | null) ?? null);
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, user]);

  if (loading) return <p className="p-10 text-sm text-muted-foreground">Chargement...</p>;
  if (!user) return null;
  if (!allowed) return null;
  if (!restaurant) return <main className="p-10 text-sm text-muted-foreground">Restaurant introuvable.</main>;

  async function saveRestaurant(patch: Partial<Pick<Restaurant, "status" | "is_public" | "lat" | "lng">>) {
    const currentRestaurant = restaurant;
    if (!currentRestaurant) return;
    const { error } = await supabase.from("restaurants").update(patch).eq("id", currentRestaurant.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Restaurant mis a jour");
    setRestaurant((current) => (current ? { ...current, ...patch } : current));
  }

  async function addMember() {
    const currentRestaurant = restaurant;
    if (!currentRestaurant) return;
    const email = memberEmail.trim();
    if (!email) {
      toast.error("Renseignez un e-mail.");
      return;
    }
    try {
      const { error } = await supabase.rpc("super_admin_add_restaurant_member", {
        _restaurant_id: currentRestaurant.id,
        _email: email,
        _role: memberRole,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Membre ajoute (ou mis a jour) pour ce restaurant");
      setMemberEmail("");
      await loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue lors de l'ajout du membre.");
    }
  }

  async function changeMemberRole(member: Membership, nextRole: (typeof ROLES)[number]) {
    if (!member.email) {
      toast.error("E-mail introuvable pour ce membre.");
      return;
    }
    try {
      const { error } = await supabase.rpc("super_admin_add_restaurant_member", {
        _restaurant_id: restaurantId,
        _email: member.email,
        _role: nextRole,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Rôle mis à jour : ${nextRole}`);
      await loadMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du changement de rôle.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">Restaurant</p>
            <h1 className="mt-2 text-3xl font-semibold">{restaurant.name}</h1>
            <p className="mt-2 text-sm text-slate-300">{restaurant.slug}</p>
          </div>
          <Link to="/super-admin" className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100">Retour</Link>
        </div>

        <InfoSection restaurant={restaurant} onSave={saveRestaurant} />
        <LocationSection restaurant={restaurant} onSave={saveRestaurant} />

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Administrateurs</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Rôle</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-3 py-3">{member.email ?? "-"}</td>
                    <td className="px-3 py-3">{member.role}</td>
                    <td className="px-3 py-3">{member.status ?? "-"}</td>
                    <td className="px-3 py-3">
                      <select
                        defaultValue={member.role}
                        onChange={(e) => void changeMemberRole(member, e.target.value as (typeof ROLES)[number])}
                        className="h-9 rounded-lg border border-white/10 bg-slate-900 px-2 text-xs"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>Passer à : {role}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-slate-400" colSpan={4}>Aucun membre pour ce restaurant.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Ajouter un membre</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-2">
              <Label>Email de l&apos;utilisateur</Label>
              <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className="bg-slate-900 text-slate-100" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as typeof memberRole)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm">
                {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div className="flex items-end md:col-span-2">
              <Button onClick={addMember} className="w-full">Ajouter</Button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Permissions</h2>
          <p className="mt-1 text-sm text-slate-400">RBAC existant, appliqué à tous les tenants -- aucun rôle personnalisé.</p>
          <div className="mt-4 space-y-3">
            {ROLES.map((role) => (
              <div key={role} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <p className="text-sm font-semibold capitalize text-cyan-300">{role}</p>
                <p className="mt-1 text-sm text-slate-300">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </div>
        </section>

        <SubscriptionSection restaurantId={restaurant.id} />

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">QR Code</h2>
          <p className="mt-1 text-sm text-slate-400">Identique à celui que le tenant voit dans son propre espace -- même URL, mêmes statistiques.</p>
          <div className="mt-4 rounded-2xl bg-white p-4 text-slate-900">
            <QrCodeCard restaurant={restaurant} restaurantId={restaurant.id} />
          </div>
        </section>

        <StatisticsSection restaurantId={restaurant.id} currency={restaurant.currency} />
        <ActivitySection restaurantId={restaurant.id} />
        <SecuritySection restaurantId={restaurant.id} restaurantName={restaurant.name} />
      </div>
    </main>
  );
}

function InfoSection({
  restaurant,
  onSave,
}: {
  restaurant: Restaurant;
  onSave: (patch: Partial<Pick<Restaurant, "status" | "is_public">>) => Promise<void>;
}) {
  return (
    <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Informations</p>
        <div className="flex items-center gap-3">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-white/10 object-cover" />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-xl border border-dashed border-white/15" />
          )}
          <p className="text-xs text-slate-400">Logo -- géré depuis l&apos;espace du tenant (Admin &gt; Menu).</p>
        </div>
        {restaurant.cover_url && (
          <img src={restaurant.cover_url} alt="" className="h-24 w-full rounded-xl border border-white/10 object-cover" />
        )}
        <p className="text-sm text-slate-300">Email: {restaurant.email ?? "-"}</p>
        <p className="text-sm text-slate-300">Phone: {restaurant.phone ?? "-"}</p>
        <p className="text-sm text-slate-300">WhatsApp: {restaurant.whatsapp_phone ?? "-"}</p>
        <p className="text-sm text-slate-300">Adresse: {restaurant.address ?? "-"}</p>
        <p className="text-sm text-slate-300">Commune: {restaurant.commune ?? "-"}</p>
        <p className="text-sm text-slate-300">Ville: {restaurant.city ?? "-"}</p>
        <p className="text-sm text-slate-300">Devise: {restaurant.currency}</p>
        <p className="text-sm text-slate-300">Fuseau horaire: {restaurant.timezone}</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-slate-200">Status</Label>
          <select value={restaurant.status} onChange={(e) => void onSave({ status: e.target.value as Restaurant["status"] })} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-slate-500">Suspendre bloque l&apos;accès sans supprimer aucune donnée -- réactivable à tout moment.</p>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
          <input type="checkbox" checked={restaurant.is_public} onChange={(e) => void onSave({ is_public: e.target.checked })} />
          <span className="text-sm">Visible au public</span>
        </label>
      </div>
    </section>
  );
}

function LocationSection({
  restaurant,
  onSave,
}: {
  restaurant: Restaurant;
  onSave: (patch: Partial<Pick<Restaurant, "lat" | "lng">>) => Promise<void>;
}) {
  const [lat, setLat] = useState(restaurant.lat?.toString() ?? "");
  const [lng, setLng] = useState(restaurant.lng?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsedLat = lat.trim() === "" ? null : Number(lat);
    const parsedLng = lng.trim() === "" ? null : Number(lng);
    if ((parsedLat !== null && !Number.isFinite(parsedLat)) || (parsedLng !== null && !Number.isFinite(parsedLng))) {
      toast.error("Latitude/longitude invalides.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ lat: parsedLat, lng: parsedLng });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Localisation</h2>
      <p className="mt-1 text-sm text-slate-400">
        Utilisées pour calculer la distance et les frais de livraison (public.haversine_km) -- mêmes coordonnées que
        celles déjà utilisées par create_order et le QR Code. Ne créent pas un second système de localisation.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <Label className="text-slate-200">Adresse</Label>
          <p className="mt-2 text-sm text-slate-300">{restaurant.address ?? "-"}</p>
        </div>
        <div>
          <Label className="text-slate-200">Latitude</Label>
          <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="ex: 5.35995" className="mt-2 bg-slate-900 text-slate-100" />
        </div>
        <div>
          <Label className="text-slate-200">Longitude</Label>
          <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="ex: -4.00826" className="mt-2 bg-slate-900 text-slate-100" />
        </div>
      </div>
      <Button className="mt-4" disabled={saving} onClick={() => void save()}>
        {saving ? "Enregistrement..." : "Enregistrer la position"}
      </Button>
    </section>
  );
}

function SubscriptionSection({ restaurantId }: { restaurantId: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<RestaurantSubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPlans(), fetchRestaurantSubscription(restaurantId)])
      .then(([p, s]) => {
        if (cancelled) return;
        setPlans(p);
        setSubscription(s);
        setSelectedPlan(s?.plan_id ?? p[0]?.id ?? "");
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de charger l'abonnement."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  async function save() {
    if (!selectedPlan) return;
    setSaving(true);
    try {
      await setTenantPlan(restaurantId, selectedPlan);
      toast.success("Plan mis à jour");
      setSubscription((c) => (c ? { ...c, plan_id: selectedPlan } : c));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de changer le plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Abonnement</h2>
      {loading ? (
        <p className="mt-3 text-sm text-slate-400">Chargement...</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-300">
            Plan actuel : <span className="font-semibold text-cyan-300">{plans.find((p) => p.id === subscription?.plan_id)?.name ?? subscription?.plan_id ?? "-"}</span>
            {subscription?.status && <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">({subscription.status})</span>}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} -- {formatMoney(p.price_amount, p.currency)}/{p.billing_period === "yearly" ? "an" : "mois"}
                </option>
              ))}
            </select>
            <Button disabled={saving || selectedPlan === subscription?.plan_id} onClick={() => void save()}>
              {saving ? "Enregistrement..." : "Changer le plan"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function StatisticsSection({ restaurantId, currency }: { restaurantId: string; currency: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [qrStats, setQrStats] = useState<TenantQrStats | null>(null);
  const [counts, setCounts] = useState<{ customers: number; trackedProducts: number; deliveryOrders: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    Promise.all([
      fetchDashboardStats(start, end, restaurantId),
      fetchTenantQrStats(restaurantId),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
      supabase.from("inventory").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("tracking_enabled", true),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("fulfillment_type", "delivery")
        .gte("created_at", start.toISOString()),
    ])
      .then(([dashboard, qr, customersRes, inventoryRes, deliveryRes]) => {
        if (cancelled) return;
        setStats(dashboard);
        setQrStats(qr);
        setCounts({
          customers: customersRes.count ?? 0,
          trackedProducts: inventoryRes.count ?? 0,
          deliveryOrders: deliveryRes.count ?? 0,
        });
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de charger les statistiques."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Statistiques</h2>
      <p className="mt-1 text-sm text-slate-400">30 derniers jours -- mêmes calculs que le dashboard du tenant (get_restaurant_dashboard_stats).</p>
      {loading || !stats || !counts ? (
        <p className="mt-3 text-sm text-slate-400">Chargement...</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 text-slate-900 sm:grid-cols-4">
          <StatCard label="Commandes" value={String(stats.current.total_orders)} />
          <StatCard label="CA produits" value={formatMoney(stats.financials.restaurant_revenue, currency)} />
          <StatCard label="Net restaurant" value={formatMoney(stats.financials.restaurant_net, currency)} />
          <StatCard label="Clients" value={String(counts.customers)} />
          <StatCard label="Commandes livraison" value={String(counts.deliveryOrders)} />
          <StatCard label="Commandes QR" value={String(qrStats?.qr_orders_count ?? 0)} />
          <StatCard label="Produits suivis en stock" value={String(counts.trackedProducts)} />
        </div>
      )}
    </section>
  );
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  order_status_changed: "Statut de commande modifié",
  order_cancelled: "Commande annulée",
  payment_status_changed: "Paiement modifié",
  refund_created: "Remboursement enregistré",
  restaurant_settings_changed: "Paramètres modifiés",
  commission_rate_changed: "Commission modifiée",
  driver_delivery_status_changed: "Étape de livraison modifiée",
  driver_reported_issue: "Problème signalé par un livreur",
  plan_changed_by_super_admin: "Plan changé par le Super Admin",
};

function ActivitySection({ restaurantId }: { restaurantId: string }) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,action,entity_type,created_at,metadata")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) toast.error(error.message);
      setRows((data ?? []) as unknown as AuditLogRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Activité</h2>
      <p className="mt-1 text-sm text-slate-400">20 derniers événements (audit_logs) -- même source que l&apos;historique déjà utilisé ailleurs dans l&apos;app.</p>
      {loading ? (
        <p className="mt-3 text-sm text-slate-400">Chargement...</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Aucune activité enregistrée.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm">
              <span>{AUDIT_ACTION_LABELS[row.action] ?? row.action}</span>
              <span className="shrink-0 text-xs text-slate-500">{new Date(row.created_at).toLocaleString("fr-FR")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SecuritySection({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (newPassword.length < 8) {
      toast.error("8 caractères minimum.");
      return;
    }
    setBusy(true);
    try {
      await resetTenantPassword(restaurantId, newPassword);
      toast.success(`Mot de passe réinitialisé pour le propriétaire de ${restaurantName}`);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de réinitialiser le mot de passe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Sécurité</h2>
      <p className="mt-1 text-sm text-slate-400">
        Réinitialise le mot de passe du propriétaire de ce restaurant (via l&apos;Admin API, jamais affiché ni
        réenregistré après coup).
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nouveau mot de passe (8+ caractères)"
          className="bg-slate-900 text-slate-100"
        />
        <Button disabled={busy || newPassword.length < 8} onClick={() => void submit()}>
          {busy ? "Réinitialisation..." : "Réinitialiser"}
        </Button>
      </div>
    </section>
  );
}
