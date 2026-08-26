import { useEffect, useState } from "react";
import { Eye, MessageCircle, Pencil, Plus, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchCustomers, normalizePhoneForWhatsApp, type Customer, type CustomerSource } from "@/lib/customers-db";
import { formatMoney as money } from "@/lib/currency";
import { CustomerDetailSheet } from "./CustomerDetailSheet";
import { EditCustomerDialog } from "./EditCustomerDialog";
import { AddClientDialog } from "./AddClientDialog";

const SOURCE_FILTERS: { value: CustomerSource | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "website", label: "Clients du site" },
  { value: "restaurant", label: "Ajoutés par le restaurant" },
];

const SOURCE_BADGE: Record<CustomerSource, { label: string; className: string }> = {
  website: { label: "Client du site", className: "bg-muted text-muted-foreground" },
  restaurant: { label: "Ajouté par le restaurant", className: "bg-primary/10 text-primary" },
};

function timeAgo(iso: string | null) {
  if (!iso) return "Jamais";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function whatsappHref(phone: string): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  return normalized ? `https://wa.me/${normalized}` : null;
}

/** Compact "Actif" / "Régulier" / "Nouveau" read purely off orders_count and recency -- not a stored field, since there's no separate loyalty system to source a real status from. */
function customerStatus(customer: Customer): { label: string; className: string } {
  const daysSinceLast = customer.last_order_at ? (Date.now() - new Date(customer.last_order_at).getTime()) / 86_400_000 : Infinity;
  if (daysSinceLast > 60) return { label: "Inactif", className: "bg-muted text-muted-foreground" };
  if (customer.orders_count >= 5) return { label: "Régulier", className: "bg-emerald-100 text-emerald-700" };
  return { label: "Actif", className: "bg-primary/10 text-primary" };
}

export function CustomersPanel({ restaurantId, currency }: { restaurantId: string | null; currency: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<CustomerSource | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const handle = window.setTimeout(() => {
      fetchCustomers(restaurantId, { search, page, source: sourceFilter })
        .then(({ customers: rows, total: count }) => {
          if (cancelled) return;
          setCustomers(rows);
          setTotal(count);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les clients.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [restaurantId, search, page, sourceFilter]);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function refresh() {
    if (!restaurantId) return;
    setLoading(true);
    fetchCustomers(restaurantId, { search, page, source: sourceFilter })
      .then(({ customers: rows, total: count }) => {
        setCustomers(rows);
        setTotal(count);
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">Historique et coordonnées de chaque client, centralisés depuis vos commandes.</p>
        </div>
        {restaurantId && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter un client
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setSourceFilter(f.value);
              setPage(0);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              sourceFilter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Rechercher par nom, numéro ou email..."
          className="pl-9"
        />
      </div>

      {error && <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading && customers.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chargement des clients...</p>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{search ? "Aucun client ne correspond à cette recherche." : "Aucun client pour le moment."}</p>
        </div>
      ) : (
        <>
          {/* Desktop: table. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Téléphone</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Commandes</th>
                  <th className="px-4 py-3 text-right">Total dépensé</th>
                  <th className="px-4 py-3 text-left">Dernière activité</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const status = customerStatus(c);
                  const wa = whatsappHref(c.phone);
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(c.full_name)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.full_name}</p>
                            <Badge variant="outline" className={`mt-0.5 ${status.className}`}>{status.label}</Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                      <td className="px-4 py-3"><Badge className={SOURCE_BADGE[c.source].className}>{SOURCE_BADGE[c.source].label}</Badge></td>
                      <td className="px-4 py-3 text-right">{c.orders_count}</td>
                      <td className="px-4 py-3 text-right font-medium">{money(c.total_spent, currency)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(c.last_order_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Voir la fiche" aria-label="Voir la fiche" onClick={() => setDetailId(c.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent">
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          )}
                          <Button variant="ghost" size="icon" title="Modifier" aria-label="Modifier" onClick={() => setEditTarget(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: compact cards. */}
          <div className="space-y-2.5 md:hidden">
            {customers.map((c) => {
              const status = customerStatus(c);
              const wa = whatsappHref(c.phone);
              return (
                <div key={c.id} className="rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(c.full_name)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.full_name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <Badge variant="outline" className={status.className}>{status.label}</Badge>
                          <Badge className={SOURCE_BADGE[c.source].className}>{SOURCE_BADGE[c.source].label}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.phone}</span>
                    <span>{c.orders_count} commande{c.orders_count > 1 ? "s" : ""} · {money(c.total_spent, currency)}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                    <span className="text-xs text-muted-foreground">{timeAgo(c.last_order_at)}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9" title="Voir la fiche" aria-label="Voir la fiche" onClick={() => setDetailId(c.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-9 w-9" title="Modifier" aria-label="Modifier" onClick={() => setEditTarget(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Précédent</Button>
              <span className="text-xs text-muted-foreground">Page {page + 1} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Suivant</Button>
            </div>
          )}
        </>
      )}

      <CustomerDetailSheet customerId={detailId} currency={currency} onClose={() => setDetailId(null)} />
      <EditCustomerDialog
        customer={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          refresh();
        }}
      />
      {restaurantId && (
        <AddClientDialog
          restaurantId={restaurantId}
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
