import { AlertCircle, Check, HelpCircle } from "lucide-react";
import { SecondaryScreenHeader } from "@/components/driver/SecondaryScreenHeader";
import type { DriverStatsData } from "@/components/driver/DriverStats";

type ReadinessStatus = "ok" | "attention" | "unavailable";

const STATUS_STYLE: Record<ReadinessStatus, { icon: typeof Check; className: string }> = {
  ok: { icon: Check, className: "bg-[#22A447]/10 text-[#22A447]" },
  attention: { icon: AlertCircle, className: "bg-[#F59E0B]/10 text-[#F59E0B]" },
  unavailable: { icon: HelpCircle, className: "bg-secondary text-muted-foreground" },
};

function ReadinessItem({ label, detail, status }: { label: string; detail: string; status: ReadinessStatus }) {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${className}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

/**
 * "Avant de commencer" readiness checklist. Only shows items this app can
 * actually verify for the signed-in driver today:
 *  - Disponibilité: the same `available` state driving AvailabilityToggle.
 *  - Taux d'acceptation: the same real, RLS-scoped figure as DriverStats.
 *  - Véhicule / documents: `vehicles` and any document table are
 *    owner/manager-only via RLS -- there is no driver-readable verification
 *    status anywhere in this schema, so these render as "unavailable"
 *    (pointing to the restaurant) rather than a fabricated green check.
 * "Sac isotherme" from the reference mockup has no backing data anywhere in
 * this app and is intentionally omitted rather than shown as a fake toggle.
 */
export function ReadinessTab({ available, stats, onBack }: { available: boolean; stats: DriverStatsData | null; onBack: () => void }) {
  const acceptanceRatePct = stats?.acceptanceRatePct ?? null;
  const acceptanceStatus: ReadinessStatus = acceptanceRatePct === null ? "unavailable" : acceptanceRatePct >= 50 ? "ok" : "attention";
  const acceptanceDetail = acceptanceRatePct === null ? "Pas encore d'historique." : `${acceptanceRatePct}% sur vos dernières propositions.`;

  return (
    <>
      <SecondaryScreenHeader title="Avant de commencer" onBack={onBack} />
      <ul className="space-y-2">
        <ReadinessItem
          label="Disponibilité"
          detail={available ? "Vous êtes en ligne et pouvez recevoir des courses." : "Vous êtes hors ligne -- passez disponible pour recevoir des courses."}
          status={available ? "ok" : "attention"}
        />
        <ReadinessItem label="Taux d'acceptation" detail={acceptanceDetail} status={acceptanceStatus} />
        <ReadinessItem label="Véhicule vérifié" detail="Non consultable depuis cet espace -- vérifiez ce point auprès de votre restaurant." status="unavailable" />
        <ReadinessItem label="Documents vérifiés" detail="Non consultable depuis cet espace -- vérifiez ce point auprès de votre restaurant." status="unavailable" />
      </ul>
    </>
  );
}
