import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Ban,
  Building2,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME } from "@/lib/theme";
import {
  createTenant,
  fetchTenants,
  type RestaurantStatus,
  type TenantRow,
} from "@/lib/superAdminTenants";
import { ReviewReportsSection } from "@/components/superadmin/ReviewReportsSection";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import { SuperAdminKpiCard } from "@/components/superadmin/SuperAdminKpiCard";
import { TenantsTable } from "@/components/superadmin/tenants/TenantsTable";
import {
  isRecentlyCreated,
  TenantStatusBadge,
} from "@/components/superadmin/tenants/TenantStatusBadge";
import {
  listDeliveriesForDispatch,
  listSaoviaAgentsForDispatch,
  assignAgentToDelivery,
  type DispatchDelivery,
  type DeliveryOrigin,
  type SaoviaAgentForDispatch,
  type DeliveryAssignmentRole,
} from "@/lib/dispatch";
import type { DeliveryServiceLevel } from "@/lib/organizationDelivery";

const STATUSES = ["trial", "active", "suspended", "archived"] as const;
const STATUS_LABELS: Record<RestaurantStatus, string> = {
  trial: "Essai",
  active: "Actif",
  suspended: "Suspendu",
  archived: "Archivé",
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

function exportTenantsCsv(rows: TenantRow[]) {
  const header = ["Restaurant", "Administrateur", "Email", "Statut", "Inscription"];
  const lines = rows.map((t) =>
    [
      t.name,
      t.owner_name ?? "",
      t.owner_email ?? "",
      STATUS_LABELS[t.status],
      new Date(t.created_at).toLocaleDateString("fr-FR"),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tenants-saovia-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type IndexSearchParams = { q?: string };

export const Route = createFileRoute("/super-admin/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): IndexSearchParams => {
    const result: IndexSearchParams = {};
    if (typeof search["q"] === "string" && search["q"].length > 0) result.q = search["q"];
    return result;
  },
  component: SuperAdminIndexPage,
});

const TABS = [
  { id: "restaurants", label: "Restaurants" },
  { id: "users", label: "Utilisateurs" },
  { id: "commandes", label: "Commandes" },
  { id: "activity", label: "Activité récente" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function SuperAdminIndexPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadOk, setLoadOk] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("restaurants");
  const [createOpen, setCreateOpen] = useState(false);
  const hash = useRouterState({ select: (s) => s.location.hash });

  async function load() {
    setLoading(true);
    try {
      setTenants(await fetchTenants());
      setLoadOk(true);
    } catch (err) {
      setLoadOk(false);
      toast.error(err instanceof Error ? err.message : "Impossible de charger les tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (hash === "tenants") setActiveTab("restaurants");
  }, [hash]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: tenants.length,
      active: tenants.filter((t) => t.status === "active").length,
      suspended: tenants.filter((t) => t.status === "suspended").length,
      recent: tenants.filter((t) => new Date(t.created_at).getTime() >= weekAgo).length,
    };
  }, [tenants]);

  function openCreateTenant() {
    setCreateOpen(true);
    document
      .getElementById("create-tenant")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <DashboardGreeting ok={loadOk} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SuperAdminKpiCard
          icon={Building2}
          label="Total tenants"
          value={String(stats.total)}
          accent="blue"
        />
        <SuperAdminKpiCard
          icon={CheckCircle2}
          label="Tenants actifs"
          value={String(stats.active)}
          accent="emerald"
        />
        <SuperAdminKpiCard
          icon={Ban}
          label="Tenants suspendus"
          value={String(stats.suspended)}
          accent="red"
        />
        <SuperAdminKpiCard
          icon={Sparkles}
          label="Nouveaux (7j)"
          value={String(stats.recent)}
          accent="violet"
        />
      </div>

      <PilotageTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "restaurants" && (
        <TenantsSection
          tenants={tenants}
          loading={loading}
          onStatusChanged={load}
          onOpenCreate={openCreateTenant}
        />
      )}
      {activeTab === "users" && <UsersBlock tenants={tenants} />}
      {activeTab === "commandes" && <CommandesTabCta />}
      {activeTab === "activity" && <RecentActivitySection tenants={tenants} />}

      <CreateTenantForm open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <ReviewReportsSection />
      <DispatchBlock />
      <ThemesBlock />
      <PlatformSettingsBlock />
      <SecuriteBlock email={user?.email ?? null} />
    </>
  );
}

function DashboardGreeting({ ok }: { ok: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <section id="overview" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Bonjour 👋</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-slate-900 sm:text-4xl">
            Bienvenue sur SAOVIA
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Gérez vos restaurants, suivez vos performances et développez votre réseau.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm text-slate-500">
          <p className="capitalize">
            {dateLabel} · {timeLabel}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-red-500")}
            />
            {ok ? "Système opérationnel" : "Erreur de synchronisation"}
          </span>
        </div>
      </div>
    </section>
  );
}

function PilotageTabs({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            active === t.id
              ? "bg-[color:var(--sa-blue)] text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function TenantsSection({
  tenants,
  loading,
  onStatusChanged,
  onOpenCreate,
}: {
  tenants: TenantRow[];
  loading: boolean;
  onStatusChanged: () => void;
  onOpenCreate: () => void;
}) {
  const search = Route.useSearch();
  const [status, setStatus] = useState<RestaurantStatus | "all" | "new">("all");
  const [query, setQuery] = useState(search.q ?? "");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  const filtered = useMemo(() => {
    let list = tenants;
    if (status === "new") list = list.filter((t) => isRecentlyCreated(t.created_at));
    else if (status !== "all") list = list.filter((t) => t.status === status);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) =>
      [t.name, t.slug, t.owner_email, t.owner_name].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [tenants, status, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  async function toggleStatus(tenant: TenantRow) {
    const nextStatus: RestaurantStatus = tenant.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase
      .from("restaurants")
      .update({ status: nextStatus })
      .eq("id", tenant.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(nextStatus === "suspended" ? "Tenant désactivé" : "Tenant activé");
    onStatusChanged();
  }

  return (
    <section id="tenants" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
            Tenants
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Liste des restaurants / tenants
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Gérez l&apos;ensemble de vos restaurants partenaires.
          </p>
        </div>
        <Button
          onClick={onOpenCreate}
          className="gap-2 bg-[color:var(--sa-blue)] text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Nouveau tenant
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un restaurant, administrateur, email..."
            autoComplete="off"
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RestaurantStatus | "all" | "new")}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="all">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
          <option value="new">Nouveau (7j)</option>
        </select>
        <Button variant="outline" className="gap-2" onClick={() => exportTenantsCsv(filtered)}>
          <Download className="h-4 w-4" /> Exporter
        </Button>
      </div>

      <TenantsTable
        tenants={pageItems}
        startIndex={startIndex}
        loading={loading}
        onToggleStatus={(t) => void toggleStatus(t)}
      />

      {!loading && filtered.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            Affichage de {startIndex + 1} à {Math.min(startIndex + pageSize, filtered.length)} sur{" "}
            {filtered.length} résultats
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </Button>
            <span className="text-xs text-slate-400">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function RecentActivitySection({ tenants }: { tenants: TenantRow[] }) {
  const recent = useMemo(
    () =>
      [...tenants]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
    [tenants],
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
        Activité récente
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Derniers tenants inscrits</h2>
      <p className="mt-1 text-sm text-slate-500">
        Les restaurants les plus récemment créés sur la plateforme.
      </p>
      <div className="mt-5 divide-y divide-slate-100">
        {recent.length === 0 && (
          <p className="py-6 text-sm text-slate-500">Aucune activité récente.</p>
        )}
        {recent.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                style={{
                  backgroundColor: t.primary_color ?? DEFAULT_THEME.primary_color ?? "#2563eb",
                }}
              >
                {t.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500">
                  Inscrit le {new Date(t.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <TenantStatusBadge status={t.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CommandesTabCta() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
        Commandes
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Commandes multi-restaurants</h2>
      <p className="mt-1 max-w-xl text-sm text-slate-500">
        Le suivi détaillé des commandes cross-tenant (KPIs, filtres, liste complète) vit sur sa
        propre page dédiée.
      </p>
      <Link
        to="/super-admin/commandes"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[color:var(--sa-blue)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Voir les commandes <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

const DISPATCH_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  pending_pickup: "En attente de collecte",
  assigned_pickup: "Collecte affectée",
  picked_up: "Collectée",
  ready_for_delivery: "Prête pour livraison",
  assigned_delivery: "Livraison affectée",
  in_transit: "En livraison",
  delivered: "Livrée",
  delivery_failed: "Échec de livraison",
  cancelled: "Annulée",
  returned: "Retournée",
};

const ORIGIN_LABELS: Record<DeliveryOrigin, string> = {
  RESTAURANT: "Restaurant",
  HORS_RESTAURANT: "Hors restaurant",
};

/**
 * assign_agent_to_delivery() enforces the real pickup-before-delivery
 * sequencing and double-booking protection server-side (validated live via
 * SQL impersonation, not assumed here) -- this UI only offers the choice of
 * role, it never guesses which one is valid; an invalid step simply surfaces
 * the RPC's own rejection message via toast.
 */
function DispatchBlock() {
  const [deliveries, setDeliveries] = useState<DispatchDelivery[]>([]);
  const [agents, setAgents] = useState<SaoviaAgentForDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [originFilter, setOriginFilter] = useState<DeliveryOrigin | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<DeliveryServiceLevel | "all">("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<DeliveryAssignmentRole>("pickup");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        listDeliveriesForDispatch({
          origin: originFilter === "all" ? undefined : originFilter,
          serviceLevel: serviceFilter === "all" ? undefined : serviceFilter,
        }),
        listSaoviaAgentsForDispatch(),
      ]);
      setDeliveries(d);
      setAgents(a);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible de charger les livraisons à dispatcher.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originFilter, serviceFilter]);

  function openAssign(delivery: DispatchDelivery) {
    setAssigningId(delivery.id);
    setSelectedAgentId("");
    setSelectedRole(delivery.assigned_pickup_agent_id ? "delivery" : "pickup");
  }

  async function submitAssign(deliveryId: string) {
    if (!selectedAgentId) {
      toast.error("Sélectionnez un livreur partenaire.");
      return;
    }
    setSubmitting(true);
    try {
      await assignAgentToDelivery(deliveryId, selectedAgentId, selectedRole);
      toast.success("Livreur affecté.");
      setAssigningId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Affectation impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="dispatch" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
          SAOVIA Delivery
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Livraisons à dispatcher</h2>
        <p className="mt-1 text-sm text-slate-500">
          Affectez un livreur partenaire SAOVIA aux livraisons restaurant et hors restaurant.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "RESTAURANT", "HORS_RESTAURANT"] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOriginFilter(o)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
              originFilter === o
                ? "bg-[color:var(--sa-blue)] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {o === "all" ? "Toutes origines" : ORIGIN_LABELS[o]}
          </button>
        ))}
        {(["all", "EXPRESS", "SCHEDULED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setServiceFilter(s)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
              serviceFilter === s
                ? "bg-[color:var(--sa-blue)] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {s === "all" ? "Tous services" : s === "EXPRESS" ? "Express" : "Programmées"}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading && <p className="py-6 text-center text-sm text-slate-500">Chargement...</p>}
        {!loading && deliveries.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">Aucune livraison.</p>
        )}
        {!loading &&
          deliveries.map((d) => (
            <div key={d.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                    {ORIGIN_LABELS[d.origin]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                    {d.service_level === "EXPRESS" ? "Express" : "Programmée"}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-blue-800">
                    {DISPATCH_STATUS_LABELS[d.status] ?? d.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(d.created_at).toLocaleString("fr-FR")}
                </p>
              </div>

              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <p className="font-medium">{d.organization_name}</p>
                  <p className="text-slate-500">Commande {d.order_id}</p>
                </div>
                <div className="text-slate-600">
                  <p>
                    Collecte : {d.pickup_name} · {d.pickup_address}
                  </p>
                  <p>
                    Livraison : {d.destination_name} · {d.destination_address}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                <div className="text-slate-600">
                  <p>Collecte : {d.assigned_pickup_agent_name ?? "Non affecté"}</p>
                  <p>Livraison : {d.assigned_delivery_agent_name ?? "Non affecté"}</p>
                </div>
                {d.delivery_fee != null && (
                  <p className="font-semibold">{d.delivery_fee.toLocaleString("fr-FR")} FCFA</p>
                )}
                <Button size="sm" variant="outline" onClick={() => openAssign(d)}>
                  Attribuer un livreur
                </Button>
              </div>

              {assigningId === d.id && (
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600">Livreur partenaire</span>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="">Sélectionner...</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name} {a.is_active ? "" : "(inactif)"} --{" "}
                          {a.active_missions_count} mission(s) en cours
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600">Étape</span>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as DeliveryAssignmentRole)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="pickup">Collecte</option>
                      <option value="delivery">Livraison</option>
                    </select>
                  </label>
                  <Button size="sm" onClick={() => void submitAssign(d.id)} disabled={submitting}>
                    {submitting ? "Affectation..." : "Confirmer"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAssigningId(null)}>
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          ))}
      </div>
    </section>
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

function CreateTenantForm({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
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
  const [confirmation, setConfirmation] = useState<{
    name: string;
    slug: string;
    email: string;
  } | null>(null);

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
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer le tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="create-tenant"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
            Tenants
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Créer un nouveau tenant</h2>
        </div>
        {open && (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        )}
      </div>

      {confirmation && (
        <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-900">Tenant créé : {confirmation.name}</p>
          <p className="mt-1 text-sm text-emerald-800">
            E-mail de connexion : {confirmation.email}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Le mot de passe n&apos;est ni affiché ni enregistré à nouveau -- il a été défini une
            seule fois lors de la création.
          </p>
          <div className="mt-3 flex gap-3">
            <a href={`/r/${confirmation.slug}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                Ouvrir l&apos;espace tenant
              </Button>
            </a>
            <Button size="sm" variant="ghost" onClick={() => setConfirmation(null)}>
              Fermer
            </Button>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Restaurant
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom officiel">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Slug (URL)">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto si vide"
                />
              </Field>
              <Field label="Téléphone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="WhatsApp">
                <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
              </Field>
              <Field label="Email restaurant">
                <Input
                  type="email"
                  value={restaurantEmail}
                  onChange={(e) => setRestaurantEmail(e.target.value)}
                />
              </Field>
              <Field label="Ville">
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="Commune">
                <Input value={commune} onChange={(e) => setCommune(e.target.value)} />
              </Field>
              <Field label="Statut initial">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RestaurantStatus)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Adresse">
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Administrateur (tenant)
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom du responsable">
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              </Field>
              <Field label="Email de connexion">
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </Field>
              <Field label="Mot de passe initial">
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="8+ caractères, lettres et chiffres"
                />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Thème officiel
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Laissez vide pour utiliser le thème officiel par défaut de la plateforme.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <ColorField
                label="Couleur principale"
                value={theme.primary_color}
                onChange={(v) => setTheme((t) => ({ ...t, primary_color: v }))}
              />
              <ColorField
                label="Couleur secondaire"
                value={theme.secondary_color}
                onChange={(v) => setTheme((t) => ({ ...t, secondary_color: v }))}
              />
              <ColorField
                label="Couleur accent"
                value={theme.accent_color}
                onChange={(v) => setTheme((t) => ({ ...t, accent_color: v }))}
              />
              <ColorField
                label="Couleur de fond"
                value={theme.background_color}
                onChange={(v) => setTheme((t) => ({ ...t, background_color: v }))}
              />
              <ColorField
                label="Couleur des cartes"
                value={theme.surface_color}
                onChange={(v) => setTheme((t) => ({ ...t, surface_color: v }))}
              />
              <ColorField
                label="Couleur du texte"
                value={theme.text_color}
                onChange={(v) => setTheme((t) => ({ ...t, text_color: v }))}
              />
              <Field label="Police officielle">
                <Input
                  value={theme.font_family}
                  onChange={(e) => setTheme((t) => ({ ...t, font_family: e.target.value }))}
                  placeholder="ex: Inter, sans-serif"
                />
              </Field>
              <Field label="Arrondi des bords">
                <Input
                  value={theme.border_radius}
                  onChange={(e) => setTheme((t) => ({ ...t, border_radius: e.target.value }))}
                  placeholder="ex: 0.75rem"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? "Création..." : "Créer le tenant"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
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
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Thème par défaut"
        />
      </div>
    </label>
  );
}

function UsersBlock({ tenants }: { tenants: TenantRow[] }) {
  return (
    <section id="users" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
        Utilisateurs
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Administrateurs des tenants</h2>
      <p className="mt-1 text-sm text-slate-500">
        Vue en lecture seule des propriétaires de chaque restaurant.
      </p>
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
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
        Thèmes
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Thème officiel par défaut</h2>
      <p className="mt-1 text-sm text-slate-500">
        Appliqué automatiquement à tout nouveau tenant qui ne personnalise pas sa palette. Pour
        modifier le thème d&apos;un restaurant existant, ouvrez sa fiche depuis l&apos;onglet
        Tenants.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        {swatches.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"
          >
            <span
              className="h-5 w-5 rounded-full border border-slate-300"
              style={{ backgroundColor: s.value ?? undefined }}
            />
            <span className="text-sm text-slate-700">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformSettingsBlock() {
  return (
    <section
      id="platform-settings"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
        Paramètres plateforme
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Valeurs par défaut</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Statut initial des nouveaux tenants
          </dt>
          <dd className="mt-1 text-sm font-medium">Actif</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Devise par défaut</dt>
          <dd className="mt-1 text-sm font-medium">XOF</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Fuseau horaire par défaut
          </dt>
          <dd className="mt-1 text-sm font-medium">Africa/Abidjan</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Seul rôle habilité à créer un tenant
          </dt>
          <dd className="mt-1 text-sm font-medium">Super Admin</dd>
        </div>
      </dl>
    </section>
  );
}

/** Reuses SecurityCard as-is (same component as Admin Tenant > Paramètres) for the Super Admin's own account -- it only ever touches supabase.auth for the signed-in user, no restaurant scoping involved. */
function SecuriteBlock({ email }: { email: string | null }) {
  return (
    <section id="securite" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--sa-blue)]">
        Administration
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Sécurité du compte</h2>
      <p className="mt-1 text-sm text-slate-500">
        Modifiez le mot de passe de votre compte Super Admin.
      </p>
      <div className="mt-5">
        <SecurityCard email={email} />
      </div>
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
