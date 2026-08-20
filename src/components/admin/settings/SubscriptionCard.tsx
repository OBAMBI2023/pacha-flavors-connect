import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchRestaurantSubscription, type Plan, type RestaurantSubscription } from "@/lib/orders-db";

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Essai",
  past_due: "Paiement en retard",
  cancelled: "Annulé",
};

export function SubscriptionCard({ restaurantId }: { restaurantId: string | null }) {
  const [data, setData] = useState<{ subscription: RestaurantSubscription; plan: Plan } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetchRestaurantSubscription(restaurantId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (loading) return null;
  if (!data) return null;

  const features = Array.isArray(data.plan.features) ? (data.plan.features as unknown[]) : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Mon abonnement</h3>
          <p className="mt-1 text-2xl font-display font-semibold">{data.plan.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.plan.price_amount > 0
              ? `${data.plan.price_amount.toLocaleString("fr-FR")} ${data.plan.currency} / ${data.plan.billing_period === "yearly" ? "an" : "mois"}`
              : "Gratuit"}
          </p>
        </div>
        <Badge variant={data.subscription.status === "active" ? "default" : "outline"}>
          {STATUS_LABELS[data.subscription.status] ?? data.subscription.status}
        </Badge>
      </div>
      {features.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {features
            .filter((f): f is string => typeof f === "string")
            .map((f) => (
              <li key={f} className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> {f}
              </li>
            ))}
        </ul>
      )}
      {data.subscription.current_period_end && (
        <p className="mt-3 text-xs text-muted-foreground">
          Renouvellement : {new Date(data.subscription.current_period_end).toLocaleDateString("fr-FR")}
        </p>
      )}
    </div>
  );
}
