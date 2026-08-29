import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/customers-db";
import { createPromoCode, fetchPromoCodes, type PromoCode } from "@/lib/promoCodes";
import {
  AUDIENCE_SEGMENT_DEFAULTS,
  AUDIENCE_SEGMENT_LABELS,
  CAMPAIGN_OBJECTIVE_LABELS,
  createCampaign,
  fetchAudienceCustomers,
  fetchAudiencePreview,
  renderMessageTemplate,
  type AudienceFilters,
  type AudiencePreview,
  type AudienceSegmentKey,
  type CampaignObjective,
} from "@/lib/marketing";
import { useMarketingContext } from "@/hooks/useMarketingContext";

type SearchParams = { segment?: AudienceSegmentKey; param?: number };

export const Route = createFileRoute("/super-admin/marketing/campagnes_/nouvelle")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const result: SearchParams = {};
    if (typeof search["segment"] === "string") result.segment = search["segment"] as AudienceSegmentKey;
    if (typeof search["param"] === "number") result.param = search["param"];
    return result;
  },
  component: NewCampaignPage,
});

const OBJECTIVES: { id: CampaignObjective; recommendedMessage: string }[] = [
  { id: "reactivation", recommendedMessage: "Bonjour {{prenom}} 👋 Vous nous manquez ! Revenez commander chez {{nom_restaurant}} et profitez de {{montant_promo}} avec le code {{code_promo}}." },
  { id: "vip", recommendedMessage: "Bonjour {{prenom}} ⭐ Merci pour votre fidélité ! Une offre spéciale vous attend chez {{nom_restaurant}} : {{montant_promo}} avec le code {{code_promo}}." },
  { id: "new_customer", recommendedMessage: "Merci pour votre première commande chez {{nom_restaurant}} {{prenom}} 🎉 Revenez vite avec {{montant_promo}} grâce au code {{code_promo}}." },
  { id: "promotion", recommendedMessage: "Bonjour {{prenom}}, {{nom_restaurant}} vous propose {{montant_promo}} avec le code {{code_promo}}. Offre valable jusqu'au {{date_expiration}}." },
  { id: "menu", recommendedMessage: "Bonjour {{prenom}} 👋 {{nom_restaurant}} vient d'ajouter de nouveaux plats à sa carte, venez découvrir !" },
  { id: "loyalty", recommendedMessage: "Merci {{prenom}} pour votre fidélité à {{nom_restaurant}} ! Voici {{montant_promo}} avec le code {{code_promo}} pour vous remercier." },
] as const;

const SEGMENT_KEYS: AudienceSegmentKey[] = ["inactive", "vip", "new_customer", "regular", "high_value", "promo_users", "custom"];
const STEPS = ["Objectif", "Audience", "Message", "Offre", "Aperçu", "Confirmation"] as const;

type PromoChoice = "none" | "new" | "existing";

function segmentParamFilters(segment: AudienceSegmentKey, param: number | null): AudienceFilters {
  if (segment === "custom") return {};
  const base = AUDIENCE_SEGMENT_DEFAULTS[segment];
  if (param === null) return base;
  if (base.inactiveSinceDays !== undefined) return { inactiveSinceDays: param };
  if (base.minSpend !== undefined) return { minSpend: param };
  if (base.minOrders !== undefined && base.maxOrders !== undefined) return base;
  if (base.minOrders !== undefined) return { minOrders: param };
  return base;
}

function NewCampaignPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { restaurantId, restaurant } = useMarketingContext();

  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<CampaignObjective>("reactivation");
  const [segment, setSegment] = useState<AudienceSegmentKey>(search.segment ?? "inactive");
  const [segmentParam, setSegmentParam] = useState<number | null>(
    search.param ?? AUDIENCE_SEGMENT_DEFAULTS[(search.segment ?? "inactive") as Exclude<AudienceSegmentKey, "custom">]?.inactiveSinceDays ?? 14,
  );
  const [customFilters, setCustomFilters] = useState<AudienceFilters>({});
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState(OBJECTIVES[0]!.recommendedMessage);

  const [promoChoice, setPromoChoice] = useState<PromoChoice>("none");
  const [existingPromoCodes, setExistingPromoCodes] = useState<PromoCode[]>([]);
  const [existingPromoId, setExistingPromoId] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState({
    name: "",
    code: "",
    discount_type: "percentage" as "percentage" | "fixed_amount" | "free_delivery",
    discount_value: 10,
    ends_at: "",
  });
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [createdPromoId, setCreatedPromoId] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<Customer[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filters = segment === "custom" ? customFilters : segmentParamFilters(segment, segmentParam);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setPreviewLoading(true);
    fetchAudiencePreview(restaurantId, filters)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, JSON.stringify(filters)]);

  useEffect(() => {
    if (!restaurantId) return;
    void fetchPromoCodes(restaurantId).then(setExistingPromoCodes).catch(() => {});
  }, [restaurantId]);

  const selectedExistingPromo = existingPromoCodes.find((p) => p.id === existingPromoId) ?? null;
  const activePromoCode =
    promoChoice === "existing" ? selectedExistingPromo : promoChoice === "new" && createdPromoId ? { id: createdPromoId, code: newPromo.code } : null;

  const promoDiscountLabel = (() => {
    if (promoChoice === "existing" && selectedExistingPromo) {
      return selectedExistingPromo.discount_type === "percentage"
        ? `${selectedExistingPromo.discount_value}%`
        : selectedExistingPromo.discount_type === "fixed_amount"
          ? `${selectedExistingPromo.discount_value} XOF`
          : "livraison offerte";
    }
    if (promoChoice === "new") {
      return newPromo.discount_type === "percentage"
        ? `${newPromo.discount_value}%`
        : newPromo.discount_type === "fixed_amount"
          ? `${newPromo.discount_value} XOF`
          : "livraison offerte";
    }
    return "";
  })();

  const messagePreview = renderMessageTemplate(message, {
    prenom: "Awa",
    nom_restaurant: restaurant?.name ?? "votre restaurant",
    code_promo: promoChoice === "none" ? "" : promoChoice === "existing" ? selectedExistingPromo?.code ?? "" : newPromo.code || "CODE",
    montant_promo: promoDiscountLabel,
    date_expiration:
      promoChoice === "existing" && selectedExistingPromo?.ends_at
        ? new Date(selectedExistingPromo.ends_at).toLocaleDateString("fr-FR")
        : promoChoice === "new" && newPromo.ends_at
          ? new Date(newPromo.ends_at).toLocaleDateString("fr-FR")
          : "",
  });

  async function handleCreatePromo() {
    if (!restaurantId || !newPromo.name.trim() || !newPromo.code.trim()) {
      toast.error("Nom et code sont requis.");
      return;
    }
    setCreatingPromo(true);
    try {
      const id = await createPromoCode(restaurantId, {
        name: newPromo.name.trim(),
        code: newPromo.code.trim().toUpperCase(),
        discount_type: newPromo.discount_type,
        discount_value: newPromo.discount_type === "free_delivery" ? null : newPromo.discount_value,
        visibility: "targeted",
        max_total_uses: null,
        max_uses_per_customer: 1,
        starts_at: new Date().toISOString(),
        ends_at: newPromo.ends_at ? new Date(newPromo.ends_at).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      });
      setCreatedPromoId(id);
      toast.success("Code promo créé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer ce code promo.");
    } finally {
      setCreatingPromo(false);
    }
  }

  async function goToPreviewStep() {
    if (!restaurantId) return;
    setLoadingRecipients(true);
    try {
      const rows = await fetchAudienceCustomers(restaurantId, filters);
      setRecipients(rows);
      setStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger l'audience.");
    } finally {
      setLoadingRecipients(false);
    }
  }

  async function handleCreateCampaign() {
    if (!restaurantId || !restaurant) return;
    if (!campaignName.trim()) {
      toast.error("Donnez un nom à la campagne.");
      return;
    }
    setSubmitting(true);
    try {
      const promo =
        promoChoice === "existing" && selectedExistingPromo
          ? { id: selectedExistingPromo.id, code: selectedExistingPromo.code, discountLabel: promoDiscountLabel, expiresAt: selectedExistingPromo.ends_at }
          : promoChoice === "new" && createdPromoId
            ? { id: createdPromoId, code: newPromo.code.toUpperCase(), discountLabel: promoDiscountLabel, expiresAt: newPromo.ends_at || null }
            : null;
      const id = await createCampaign({
        restaurantId,
        restaurantName: restaurant.name,
        objective,
        name: campaignName.trim(),
        messageTemplate: message,
        promoCode: promo,
        audienceSegment: segment,
        audienceFilters: filters,
        recipients,
      });
      toast.success("Campagne créée -- liens WhatsApp générés");
      void navigate({ to: "/super-admin/marketing/campagnes", search: undefined as never });
      void id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer la campagne.");
    } finally {
      setSubmitting(false);
    }
  }

  const sample = useMemo(() => recipients.slice(0, 5), [recipients]);

  function setCustomFilterField(key: "minOrders" | "minSpend" | "inactiveSinceDays", raw: string) {
    setCustomFilters((c) => {
      const next = { ...c };
      if (raw) next[key] = Number(raw);
      else delete next[key];
      return next;
    });
  }

  if (!restaurantId) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => index < step && setStep(index)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
              index === step
                ? "border-primary bg-primary text-primary-foreground"
                : index < step
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-400"
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-900">Quel est l'objectif de cette campagne ?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {OBJECTIVES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setObjective(o.id);
                  setMessage(o.recommendedMessage);
                }}
                className={`rounded-2xl border p-4 text-left ${objective === o.id ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <p className="font-medium text-slate-900">{CAMPAIGN_OBJECTIVE_LABELS[o.id]}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>Suivant</Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Quelle audience cibler ?</h2>
          <div className="flex flex-wrap gap-2">
            {SEGMENT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSegment(key);
                  if (key !== "custom") {
                    const d = AUDIENCE_SEGMENT_DEFAULTS[key];
                    setSegmentParam(d.inactiveSinceDays ?? d.minOrders ?? d.minSpend ?? null);
                  }
                }}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${segment === key ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600"}`}
              >
                {AUDIENCE_SEGMENT_LABELS[key]}
              </button>
            ))}
          </div>

          {segment !== "custom" && segment !== "new_customer" && segment !== "promo_users" && (
            <label className="block max-w-xs space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                {segment === "inactive" ? "Jours d'inactivité" : segment === "high_value" ? "Montant minimum (XOF)" : "Nombre minimum de commandes"}
              </span>
              <Input type="number" min={0} value={segmentParam ?? 0} onChange={(e) => setSegmentParam(Number(e.target.value) || 0)} />
            </label>
          )}

          {segment === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Commandes min.</span>
                <Input type="number" min={0} value={customFilters.minOrders ?? ""} onChange={(e) => setCustomFilterField("minOrders", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Dépenses min. (XOF)</span>
                <Input type="number" min={0} value={customFilters.minSpend ?? ""} onChange={(e) => setCustomFilterField("minSpend", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Inactif depuis (jours)</span>
                <Input type="number" min={0} value={customFilters.inactiveSinceDays ?? ""} onChange={(e) => setCustomFilterField("inactiveSinceDays", e.target.value)} />
              </label>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {previewLoading || !preview ? (
              <p className="text-sm text-slate-500">Calcul de l'audience...</p>
            ) : (
              <>
                <p className="font-display text-2xl font-semibold text-slate-900">{preview.eligible} client{preview.eligible > 1 ? "s" : ""} ciblé{preview.eligible > 1 ? "s" : ""}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {preview.matched} correspondent au filtre sur {preview.totalBase} au total · {preview.excludedOptOut} désinscrits exclus
                  {preview.excludedRecentlyMessaged > 0 && ` · ${preview.excludedRecentlyMessaged} déjà contactés récemment (anti-spam 7j)`}
                </p>
              </>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>Précédent</Button>
            <Button onClick={() => setStep(2)} disabled={!preview || preview.eligible === 0}>Suivant</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-900">Message WhatsApp</h2>
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="text-xs text-slate-500">{message.length} caractères · Variables : {"{{prenom}} {{nom_restaurant}} {{code_promo}} {{montant_promo}} {{date_expiration}}"}</p>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Précédent</Button>
            <Button onClick={() => setStep(3)} disabled={!message.trim()}>Suivant</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Offre (optionnelle)</h2>
          <div className="flex flex-wrap gap-2">
            {(["none", "new", "existing"] as PromoChoice[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPromoChoice(c)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${promoChoice === c ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600"}`}
              >
                {c === "none" ? "Aucun code promo" : c === "new" ? "Créer un nouveau code" : "Utiliser un code existant"}
              </button>
            ))}
          </div>

          {promoChoice === "existing" && (
            <select value={existingPromoId ?? ""} onChange={(e) => setExistingPromoId(e.target.value || null)} className="h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Choisir un code...</option>
              {existingPromoCodes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          )}

          {promoChoice === "new" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <Label>Nom</Label>
                <Input value={newPromo.name} onChange={(e) => setNewPromo((c) => ({ ...c, name: e.target.value }))} />
              </label>
              <label className="space-y-1.5">
                <Label>Code</Label>
                <Input value={newPromo.code} onChange={(e) => setNewPromo((c) => ({ ...c, code: e.target.value.toUpperCase() }))} />
              </label>
              <label className="space-y-1.5">
                <Label>Type</Label>
                <select
                  value={newPromo.discount_type}
                  onChange={(e) => setNewPromo((c) => ({ ...c, discount_type: e.target.value as typeof c.discount_type }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed_amount">Montant fixe</option>
                  <option value="free_delivery">Livraison offerte</option>
                </select>
              </label>
              {newPromo.discount_type !== "free_delivery" && (
                <label className="space-y-1.5">
                  <Label>Valeur</Label>
                  <Input type="number" value={newPromo.discount_value} onChange={(e) => setNewPromo((c) => ({ ...c, discount_value: Number(e.target.value) || 0 }))} />
                </label>
              )}
              <label className="space-y-1.5">
                <Label>Expire le</Label>
                <Input type="date" value={newPromo.ends_at} onChange={(e) => setNewPromo((c) => ({ ...c, ends_at: e.target.value }))} />
              </label>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={() => void handleCreatePromo()} disabled={creatingPromo || Boolean(createdPromoId)}>
                  {createdPromoId ? "Code créé ✓" : creatingPromo ? "Création..." : "Créer ce code"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Précédent</Button>
            <Button onClick={() => void goToPreviewStep()} disabled={loadingRecipients || (promoChoice === "new" && !createdPromoId)}>
              {loadingRecipients ? "Chargement..." : "Suivant"}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Aperçu</h2>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mx-auto max-w-xs rounded-2xl bg-[#e5ddd5] p-3">
              <div className="rounded-lg bg-[#dcf8c6] p-2.5 text-sm text-slate-800 shadow">{messagePreview}</div>
            </div>
          </div>
          <p className="text-sm text-slate-600">{recipients.length} destinataire{recipients.length > 1 ? "s" : ""} réel{recipients.length > 1 ? "s" : ""}, aperçu des 5 premiers :</p>
          <ul className="space-y-1 text-sm text-slate-600">
            {sample.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 px-3 py-2">
                {c.full_name} · {c.phone}
              </li>
            ))}
          </ul>
          <label className="block max-w-sm space-y-1.5">
            <Label>Nom de la campagne</Label>
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex : Relance inactifs août" />
          </label>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>Précédent</Button>
            <Button onClick={() => setStep(5)} disabled={!campaignName.trim()}>Suivant</Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Confirmation</h2>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p><strong>{campaignName}</strong> · {CAMPAIGN_OBJECTIVE_LABELS[objective]}</p>
            <p className="mt-1">{recipients.length} destinataires · {restaurant?.name}</p>
            {activePromoCode && <p className="mt-1">Code promo : {activePromoCode.code}</p>}
            <p className="mt-2 text-xs text-slate-500">
              Aucune API WhatsApp n'étant branchée, la campagne génère un lien wa.me par client. Vous les ouvrirez et confirmerez
              l'envoi un par un depuis la liste des campagnes.
            </p>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(4)}>Précédent</Button>
            <Button onClick={() => void handleCreateCampaign()} disabled={submitting}>
              {submitting ? "Création..." : "Créer la campagne"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
