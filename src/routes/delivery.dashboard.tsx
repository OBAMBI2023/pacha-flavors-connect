import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useOrganizationAuth } from "@/hooks/useOrganizationAuth";
import { listOrganizationDeliveries, type OrganizationDelivery } from "@/lib/organizationDelivery";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TITLE = "Tableau de bord | SAOVIA Delivery";

export const Route = createFileRoute("/delivery/dashboard")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DeliveryDashboardPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  pending_pickup: "Collecte à venir",
  assigned_pickup: "Agent assigné (collecte)",
  picked_up: "Collecté",
  ready_for_delivery: "Prêt pour livraison",
  assigned_delivery: "Agent assigné (livraison)",
  in_transit: "En transit",
  delivered: "Livré",
  delivery_failed: "Échec",
  cancelled: "Annulé",
  returned: "Retourné",
};

function money(amount: number | null): string {
  return amount === null ? "--" : `${amount.toLocaleString("fr-FR")} FCFA`;
}

function DeliveryDashboardPage() {
  const navigate = useNavigate();
  const { user, organization, loading: authLoading } = useOrganizationAuth();
  const [deliveries, setDeliveries] = useState<OrganizationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/delivery/login" });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!organization) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listOrganizationDeliveries(organization.id)
      .then((rows) => {
        if (!cancelled) setDeliveries(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les livraisons.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organization]);

  if (authLoading || (user && !organization && loading)) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="mt-4 h-40 w-full" />
      </main>
    );
  }

  if (user && !organization) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Aucune organisation n'est associée à ce compte. Contactez le support ou créez une nouvelle organisation.
        </p>
        <Button className="mt-4" onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/delivery" }))}>
          Retour
        </Button>
      </main>
    );
  }

  const inProgress = deliveries.filter((d) => !["delivered", "cancelled", "delivery_failed", "returned"].includes(d.status)).length;
  const scheduled = deliveries.filter((d) => d.service_level === "SCHEDULED" && !["delivered", "cancelled"].includes(d.status)).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">{organization?.name}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Mes livraisons</h1>
        </div>
        <Button asChild className="h-11">
          <Link to="/delivery/new">Nouvelle livraison</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 text-2xl font-semibold">{deliveries.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">En cours</p><p className="mt-1 text-2xl font-semibold">{inProgress}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Programmées</p><p className="mt-1 text-2xl font-semibold">{scheduled}</p></Card>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-8">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : deliveries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <p className="text-sm text-muted-foreground">Aucune livraison pour le moment.</p>
            <Button asChild><Link to="/delivery/new">Créer votre première livraison</Link></Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Référence</th>
                  <th className="p-3">Destinataire</th>
                  <th className="p-3">Service</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Collecte</th>
                  <th className="p-3">Prix</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="p-3 font-medium">{d.order_id}</td>
                    <td className="p-3">{d.destination_name}</td>
                    <td className="p-3">{d.service_level === "EXPRESS" ? "Express" : "Programmée"}</td>
                    <td className="p-3"><Badge variant="outline">{STATUS_LABELS[d.status] ?? d.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">
                      {d.scheduled_pickup_at ? new Date(d.scheduled_pickup_at).toLocaleString("fr-FR") : "Immédiate"}
                    </td>
                    <td className="p-3">{money(d.delivery_fee)}</td>
                    <td className="p-3">
                      <Link to="/delivery/$id" params={{ id: d.id }} className="text-primary underline underline-offset-4">
                        Détail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
