import type { TimelineStep } from "./orderStatusMeta";

/**
 * Vertical progress tracker: filled dot + bold label for "done"/"current"
 * steps, hollow dot + muted label for "upcoming" ones, with the current step
 * visually dominant (bigger dot, ring, colored label) per the mobile Commandes
 * redesign spec. Built entirely from `buildStatusTimeline`'s output -- no
 * status logic lives in this component.
 */
export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCancelled = step.status === "cancelled";
        return (
          <li key={step.status} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute left-[7px] top-4 h-full w-0.5 ${
                  step.state === "done" ? "bg-emerald-500" : "bg-border"
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative mt-0.5 shrink-0 rounded-full ${
                step.state === "current"
                  ? `h-4 w-4 ring-4 ${isCancelled ? "bg-destructive ring-destructive/20" : "bg-primary ring-primary/20"}`
                  : step.state === "done"
                    ? "h-3.5 w-3.5 bg-emerald-500"
                    : "h-3.5 w-3.5 border-2 border-border bg-background"
              }`}
            />
            <div className="min-w-0 flex-1 pt-0">
              <p
                className={`text-sm ${
                  step.state === "current"
                    ? `font-bold ${isCancelled ? "text-destructive" : "text-primary"}`
                    : step.state === "done"
                      ? "font-medium text-foreground"
                      : "font-medium text-muted-foreground"
                }`}
              >
                {step.label}
              </p>
              {step.at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(step.at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
