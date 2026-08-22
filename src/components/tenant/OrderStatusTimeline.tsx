import { Check } from "lucide-react";
import { getOrderTrackingSteps, type FulfillmentType, type OrderStatus } from "@/lib/orders";

/**
 * Renders the real order-status progression from getOrderTrackingSteps --
 * never an invented step list. "compact" is a horizontal chip row (order
 * list cards); "detailed" is a vertical timeline with connecting lines
 * (order confirmation/tracking page).
 */
export function OrderStatusTimeline({
  status,
  fulfillmentType,
  variant = "detailed",
}: {
  status: OrderStatus;
  fulfillmentType?: FulfillmentType;
  variant?: "compact" | "detailed";
}) {
  if (status === "cancelled") return null;
  const steps = getOrderTrackingSteps(status, fulfillmentType);

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-4 gap-2 text-xs">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`rounded-xl px-2 py-2 text-center ${step.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {step.label}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ol>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-0.5 ${step.done ? "bg-primary" : "bg-border"}`}
              />
            )}
            <span
              className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                step.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : step.active
                    ? "border-primary bg-card text-primary"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              {step.done ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <span className={`pt-1.5 text-sm font-semibold ${step.active ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
