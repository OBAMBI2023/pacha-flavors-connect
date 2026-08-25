import { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DriverPendingProposal } from "@/lib/delivery";

function remainingSeconds(expiresAt: string): number {
  return Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000);
}

/**
 * The high-visibility "Nouvelle course" alert card. Every value shown comes
 * straight from get_driver_pending_proposal()'s curated payload -- no field
 * here is invented (there's no EXPRESS/SCHEDULED concept on this proposal
 * shape, that belongs to a different, unrelated delivery system, so it's
 * deliberately not shown). distance_km is conditionally rendered since the
 * dispatch engine can leave it null when the restaurant has no coordinates.
 */
export function ProposalAlertCard({
  proposal,
  busy,
  onAccept,
  onRefuse,
}: {
  proposal: DriverPendingProposal;
  busy: boolean;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSeconds(proposal.expires_at));

  useEffect(() => {
    setSecondsLeft(remainingSeconds(proposal.expires_at));
    const id = setInterval(() => setSecondsLeft(remainingSeconds(proposal.expires_at)), 1000);
    return () => clearInterval(id);
  }, [proposal.expires_at]);

  return (
    <div className="animate-pulse space-y-4 rounded-3xl border-2 border-primary bg-card p-5 shadow-lg motion-reduce:animate-none">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">Nouvelle course</span>
        <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          <Clock className="h-3 w-3" /> {Math.max(0, secondsLeft)}s
        </span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold">{proposal.restaurant_name}</p>
          <p className="text-sm text-muted-foreground">Commande #{proposal.order_number}</p>
        </div>
        <p className="shrink-0 font-display text-2xl font-bold text-primary">
          {proposal.total_amount.toLocaleString("fr-FR")} <span className="text-sm font-semibold">{proposal.currency}</span>
        </p>
      </div>

      {proposal.distance_km !== null && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /> ≈ {proposal.distance_km.toFixed(1)} km
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="h-12 flex-1 rounded-2xl border-destructive text-destructive hover:bg-destructive/10" disabled={busy} onClick={onRefuse}>
          Refuser
        </Button>
        <Button className="h-12 flex-1 rounded-2xl" disabled={busy} onClick={onAccept}>
          Accepter
        </Button>
      </div>
    </div>
  );
}
