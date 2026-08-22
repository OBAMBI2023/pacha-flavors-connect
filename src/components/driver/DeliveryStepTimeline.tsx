import { Check } from "lucide-react";
import type { DriverDeliveryStatus } from "@/lib/delivery";

type Step = { key: DriverDeliveryStatus; label: string };

const BASE_STEPS: Step[] = [
  { key: "assigned", label: "Course acceptée" },
  { key: "going_to_pickup", label: "En route vers le restaurant" },
  { key: "arrived_at_restaurant", label: "Arrivé au restaurant" },
  { key: "collecting", label: "Collecte" },
  { key: "collected", label: "Commande collectée" },
  { key: "en_route", label: "En route vers le client" },
  { key: "arrived_at_customer", label: "Arrivé chez le client" },
];

const CASH_STEPS: Step[] = [
  { key: "cash_collection", label: "Encaissement" },
  { key: "payment_confirmed", label: "Paiement confirmé" },
];

const FINAL_STEP: Step = { key: "delivered", label: "Livraison terminée" };

/**
 * Presentational step timeline. `cash_collection`/`payment_confirmed` are
 * only ever rendered when `isCashOrder` -- an already-paid order's timeline
 * never shows an encaissement node, so the UI itself never implies payment
 * collection is needed when it isn't.
 */
export function DeliveryStepTimeline({
  status,
  isCashOrder,
}: {
  status: DriverDeliveryStatus | null;
  isCashOrder: boolean;
}) {
  const steps = [...BASE_STEPS, ...(isCashOrder ? CASH_STEPS : []), FINAL_STEP];
  const current = status ?? "assigned";
  const currentIndex = steps.findIndex((step) => step.key === current);

  return (
    <ol className="space-y-1.5 border-t border-border pt-3 text-sm">
      {steps.map((step, index) => {
        const done = index < currentIndex || (index === currentIndex && current === "delivered");
        const active = index === currentIndex && current !== "delivered";
        return (
          <li key={step.key} className={`flex items-center gap-2 ${done || active ? "text-foreground" : "text-muted-foreground/60"}`}>
            {done ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/30"}`} />
            )}
            <span className={active ? "font-semibold" : ""}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
