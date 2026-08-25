import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useOrganizationAuth } from "@/hooks/useOrganizationAuth";
import {
  fetchDeliveryStatusHistory,
  getOrganizationDelivery,
  type DeliveryStatusHistoryEntry,
  type OrganizationDelivery,
} from "@/lib/organizationDelivery";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const TITLE = "Détail de la livraison | SAOVIA Delivery";

export const Route = createFileRoute("/delivery/$id")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DeliveryDetailPage,
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

function DeliveryDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/delivery/$id" });
  const { user, loading: authLoading } = useOrganizationAuth();
  const [delivery, setDelivery] = useState<OrganizationDelivery | null>(null);
  const [history, setHistory] = useState<DeliveryStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/delivery/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getOrganizationDelivery(id), fetchDeliveryStatusHistory(id)])
      .then(([d, h]) => {
        if (cancelled) return;
        setDelivery(d);
        setHistory(h);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger cette livraison.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-4 h-64 w-full" />
      </main>
    );
  }

  if (error || !delivery) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-destructive">{error ?? "Livraison introuvable."}</p>
        <Button asChild className="mt-4"><Link to="/delivery/dashboard">Retour au tableau de bord</Link></Button>
      </main>
    );
  }

  const hasAgent = Boolean(delivery.assigned_pickup_agent_id || delivery.assigned_delivery_agent_id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/delivery/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
        &larr; Mes livraisons
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">HORS_RESTAURANT</p>
        <h1 className="font-display text-2xl font-semibold">Commande #{delivery.order_id}</h1>
        <Badge variant="outline">{STATUS_LABELS[delivery.status] ?? delivery.status}</Badge>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="space-y-1.5 p-4 text-sm">
          <h3 className="font-semibold">Service</h3>
          <p>{delivery.service_level === "EXPRESS" ? "Express" : "Programmée"}</p>
          {delivery.scheduled_pickup_at && (
            <p className="text-muted-foreground">Collecte : {new Date(delivery.scheduled_pickup_at).toLocaleString("fr-FR")}</p>
          )}
        </Card>
        <Card className="space-y-1.5 p-4 text-sm">
          <h3 className="font-semibold">Prix</h3>
          <p>{delivery.delivery_fee !== null ? `${delivery.delivery_fee.toLocaleString("fr-FR")} FCFA` : "--"}</p>
          {delivery.delivery_distance_km !== null && <p className="text-muted-foreground">{delivery.delivery_distance_km.toFixed(1)} km</p>}
        </Card>
        <Card className="space-y-1.5 p-4 text-sm">
          <h3 className="font-semibold">Colis</h3>
          <p>{delivery.package_description ?? "--"}</p>
          <p className="text-muted-foreground">Quantité : {delivery.package_quantity}</p>
          {delivery.cod_amount !== null && <p className="text-muted-foreground">COD : {delivery.cod_amount.toLocaleString("fr-FR")} FCFA</p>}
        </Card>
        <Card className="space-y-1.5 p-4 text-sm">
          <h3 className="font-semibold">Collecte</h3>
          <p>{delivery.pickup_name}</p>
          <p className="text-muted-foreground">{delivery.pickup_address}</p>
        </Card>
        <Card className="space-y-1.5 p-4 text-sm sm:col-span-2">
          <h3 className="font-semibold">Destinataire</h3>
          <p>{delivery.destination_name} -- {delivery.destination_phone}</p>
          <p className="text-muted-foreground">{delivery.destination_address}</p>
        </Card>
        {delivery.delivery_instructions && (
          <Card className="p-4 text-sm sm:col-span-2"><h3 className="font-semibold">Instructions</h3><p className="mt-1 text-muted-foreground">{delivery.delivery_instructions}</p></Card>
        )}
      </div>

      {!hasAgent && (
        <p className="mt-4 text-xs text-muted-foreground">Aucun agent n'est encore assigné à cette livraison.</p>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold">Historique</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <span>{STATUS_LABELS[h.to_status] ?? h.to_status}</span>
                <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
