import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DriverPendingProposal } from "@/lib/delivery";

function remainingSeconds(expiresAt: string): number {
  return Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000);
}

/**
 * The high-visibility "Nouvelle course" alert card. Restaurant, order #,
 * distance, amount, and a live countdown are all shown per spec -- Accept
 * and Refuse are the only two actions, matching the required interface.
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
    <div className="mt-6 animate-pulse space-y-4 rounded-2xl border-2 border-primary bg-card p-5 shadow-lg motion-reduce:animate-none">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Nouvelle course</p>
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {Math.max(0, secondsLeft)}s
        </span>
      </div>
      <p className="font-display text-xl font-semibold">{proposal.restaurant_name}</p>
      <p className="text-sm text-muted-foreground">Commande #{proposal.order_number}</p>
      {proposal.distance_km !== null && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> ≈ {proposal.distance_km.toFixed(1)} km
        </p>
      )}
      <p className="text-lg font-semibold">
        {proposal.total_amount.toLocaleString("fr-FR")} {proposal.currency}
      </p>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="h-12 flex-1 border-destructive text-destructive hover:bg-destructive/10" disabled={busy} onClick={onRefuse}>
          Refuser
        </Button>
        <Button className="h-12 flex-1" disabled={busy} onClick={onAccept}>
          Accepter
        </Button>
      </div>
    </div>
  );
}
