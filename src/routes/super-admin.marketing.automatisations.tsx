import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, Pause, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_TRIGGER_LABELS,
  createAutomation,
  deleteAutomation,
  fetchAutomations,
  setAutomationStatus,
  type Automation,
  type AutomationStatus,
  type AutomationStep,
  type AutomationTriggerType,
} from "@/lib/marketing";
import { useMarketingContext } from "@/hooks/useMarketingContext";
import { RequireOneRestaurant } from "@/components/superadmin/marketing/RequireOneRestaurant";

export const Route = createFileRoute("/super-admin/marketing/automatisations")({
  ssr: false,
  component: MarketingAutomationsPage,
});

/** Starting-point step chain per trigger template -- editable in spirit only (this is a definition the team writes down, not a program that runs): the wording is what a human reads to know what the automation is meant to do once a real send engine exists. */
const TRIGGER_DEFAULT_STEPS: Record<AutomationTriggerType, AutomationStep[]> = {
  after_order: [
    { type: "wait", hours: 2 },
    { type: "action", description: "Envoyer un message de remerciement" },
  ],
  inactive_customer: [
    { type: "condition", description: "Dernière commande il y a plus de 14 jours" },
    { type: "action", description: "Envoyer une offre de relance" },
  ],
  first_order: [
    { type: "wait", hours: 24 },
    { type: "action", description: "Envoyer un code promo de bienvenue pour la 2e commande" },
  ],
  abandoned_cart: [
    { type: "wait", hours: 1 },
    { type: "condition", description: "Aucune commande finalisée depuis" },
    { type: "action", description: "Envoyer un rappel de panier" },
  ],
  vip_customer: [
    { type: "condition", description: "Au moins 5 commandes" },
    { type: "action", description: "Envoyer une offre exclusive VIP" },
  ],
  birthday: [
    { type: "condition", description: "Date d'anniversaire du client" },
    { type: "action", description: "Envoyer un message d'anniversaire avec code promo" },
  ],
};

const STATUS_BADGE_CLASS: Record<AutomationStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
};

function StepFlow({
  triggerType,
  steps,
}: {
  triggerType: AutomationTriggerType;
  steps: AutomationStep[];
}) {
  return (
    <ol className="space-y-1.5 text-xs text-slate-600">
      <li className="flex items-center gap-1.5 font-semibold text-slate-900">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Déclencheur :{" "}
        {AUTOMATION_TRIGGER_LABELS[triggerType]}
      </li>
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-1.5 pl-1">
          <ArrowDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
          <span>
            {step.type === "wait" && `Attente : ${step.hours}h`}
            {step.type === "condition" && `Condition : ${step.description}`}
            {step.type === "action" && `Action : ${step.description}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CreateAutomationDialog({
  restaurantId,
  open,
  onOpenChange,
  onCreated,
}: {
  restaurantId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>("after_order");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Donnez un nom à cette automatisation.");
      return;
    }
    setSubmitting(true);
    try {
      await createAutomation({
        restaurantId,
        name: name.trim(),
        triggerType,
        steps: TRIGGER_DEFAULT_STEPS[triggerType],
      });
      toast.success("Automatisation créée en brouillon");
      setName("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer cette automatisation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle automatisation</DialogTitle>
          <DialogDescription>
            Choisissez un modèle de déclencheur, puis ajustez son nom.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(AUTOMATION_TRIGGER_LABELS) as AutomationTriggerType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTriggerType(t)}
                className={`rounded-xl border p-3 text-left text-sm font-medium ${triggerType === t ? "border-primary bg-primary/5" : "border-slate-200 hover:bg-slate-50"}`}
              >
                {AUTOMATION_TRIGGER_LABELS[t]}
              </button>
            ))}
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Nom</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Relance clients inactifs"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => void handleCreate()} disabled={submitting}>
            {submitting ? "Création..." : "Créer en brouillon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutomationsList({ restaurantId }: { restaurantId: string }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    fetchAutomations(restaurantId)
      .then(setAutomations)
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : "Impossible de charger les automatisations.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [restaurantId]);

  async function toggleStatus(a: Automation) {
    setBusyId(a.id);
    try {
      await setAutomationStatus(a.id, a.status === "active" ? "paused" : "active");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(a: Automation) {
    setBusyId(a.id);
    try {
      await deleteAutomation(a.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
        Ces automatisations ne s'exécutent pas encore automatiquement -- aucun moteur d'envoi n'est
        branché. Les créer/activer prépare leur définition pour une exécution réelle à venir.
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {automations.length} automatisation{automations.length > 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle automatisation
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : automations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-sm text-slate-500">
          Aucune automatisation pour ce restaurant.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {automations.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">{a.name}</p>
                <Badge className={STATUS_BADGE_CLASS[a.status]}>
                  {AUTOMATION_STATUS_LABELS[a.status]}
                </Badge>
              </div>
              <div className="mt-3">
                <StepFlow triggerType={a.trigger_type} steps={a.steps} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === a.id}
                  onClick={() => void toggleStatus(a)}
                >
                  {a.status === "active" ? (
                    <>
                      <Pause className="mr-1.5 h-3.5 w-3.5" /> Mettre en pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-1.5 h-3.5 w-3.5" /> Activer
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === a.id}
                  onClick={() => void remove(a)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateAutomationDialog
        restaurantId={restaurantId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </div>
  );
}

function MarketingAutomationsPage() {
  const { restaurantId } = useMarketingContext();
  return (
    <RequireOneRestaurant restaurantId={restaurantId}>
      {restaurantId && restaurantId !== "all" && <AutomationsList restaurantId={restaurantId} />}
    </RequireOneRestaurant>
  );
}
