import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AUDIENCE_SEGMENT_DEFAULTS,
  AUDIENCE_SEGMENT_LABELS,
  fetchAudiencePreview,
  type AudienceFilters,
  type AudiencePreview,
  type AudienceSegmentKey,
} from "@/lib/marketing";
import { useMarketingContext } from "@/hooks/useMarketingContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SEGMENT_DESCRIPTIONS: Record<AudienceSegmentKey, string> = {
  inactive: "Dernière commande il y a plus de N jours.",
  vip: "Au moins N commandes passées.",
  new_customer: "Exactement une commande -- juste après leur premier achat.",
  regular: "Au moins N commandes -- base fidèle.",
  high_value: "Dépenses cumulées au-delà d'un seuil.",
  promo_users: "A déjà utilisé au moins un code promo de ce restaurant.",
  custom: "Filtres combinés librement.",
};

const ADJUSTABLE_SEGMENTS: Exclude<AudienceSegmentKey, "custom">[] = ["inactive", "vip", "regular", "high_value"];

function SegmentCard({ segmentKey, restaurantId }: { segmentKey: Exclude<AudienceSegmentKey, "custom">; restaurantId: string }) {
  const [param, setParam] = useState<number>(() => {
    const d = AUDIENCE_SEGMENT_DEFAULTS[segmentKey];
    return d.inactiveSinceDays ?? d.minOrders ?? d.minSpend ?? 0;
  });
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [loading, setLoading] = useState(true);

  const filters: AudienceFilters = (() => {
    const base = AUDIENCE_SEGMENT_DEFAULTS[segmentKey];
    if (base.inactiveSinceDays !== undefined) return { inactiveSinceDays: param };
    if (base.minSpend !== undefined) return { minSpend: param };
    if (base.minOrders !== undefined && base.maxOrders !== undefined) return base; // new_customer: fixed range, not adjustable
    if (base.minOrders !== undefined) return { minOrders: param };
    return base;
  })();

  const adjustable = ADJUSTABLE_SEGMENTS.includes(segmentKey);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAudiencePreview(restaurantId, filters)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, param, segmentKey]);

  const pct = preview && preview.totalBase > 0 ? Math.round((preview.eligible / preview.totalBase) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">{AUDIENCE_SEGMENT_LABELS[segmentKey]}</h3>
      <p className="mt-1 text-xs text-slate-500">{SEGMENT_DESCRIPTIONS[segmentKey]}</p>

      {adjustable && (
        <label className="mt-3 block space-y-1">
          <span className="text-xs font-medium text-slate-600">
            {segmentKey === "inactive" ? "Jours d'inactivité" : segmentKey === "high_value" ? "Montant minimum dépensé" : "Nombre minimum de commandes"}
          </span>
          <Input type="number" min={0} value={param} onChange={(e) => setParam(Number(e.target.value) || 0)} className="h-9" />
        </label>
      )}

      <div className="mt-4 space-y-1">
        {loading || !preview ? (
          <p className="text-sm text-slate-400">Calcul...</p>
        ) : (
          <>
            <p className="font-display text-2xl font-semibold text-slate-900">{preview.eligible}</p>
            <p className="text-xs text-slate-500">
              {pct}% de la base ({preview.totalBase} clients) · {preview.excludedOptOut} désinscrits exclus
              {preview.excludedRecentlyMessaged > 0 && ` · ${preview.excludedRecentlyMessaged} déjà contactés récemment`}
            </p>
          </>
        )}
      </div>

      <Link
        to="/super-admin/marketing/campagnes/nouvelle"
        search={{ segment: segmentKey, param }}
        className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary hover:bg-primary/10"
      >
        Créer une campagne pour ce segment
      </Link>
    </div>
  );
}

function MarketingAudiencesPage() {
  const { restaurantId } = useMarketingContext();
  if (!restaurantId) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Chaque compteur ci-dessous est calculé en direct sur les vraies commandes de ce restaurant -- ajustez les seuils pour voir
        l'audience changer immédiatement.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(["inactive", "vip", "new_customer", "regular", "high_value", "promo_users"] as const).map((key) => (
          <SegmentCard key={key} segmentKey={key} restaurantId={restaurantId} />
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/super-admin/marketing/audiences")({
  ssr: false,
  component: MarketingAudiencesPage,
});
