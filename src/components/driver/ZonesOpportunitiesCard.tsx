import { MapPinned } from "lucide-react";

/**
 * The reference mockup shows a "Zones & opportunités" screen with bonus
 * zones and weekly objectives. Nothing in this schema backs either concept
 * for a driver (no bonus-zone table, no objectives table tied to
 * driver_profiles) -- rather than inventing percentages, this stays a
 * static, honest "coming soon" card instead of a full fake screen.
 */
export function ZonesOpportunitiesCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
        <MapPinned className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold">Zones & opportunités</p>
        <p className="text-xs text-muted-foreground">Bientôt disponible.</p>
      </div>
    </div>
  );
}
