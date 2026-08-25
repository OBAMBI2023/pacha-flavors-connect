import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Presentational -- livreur.tsx owns the async toggleAvailability() call and the underlying setDriverAvailability() RPC wrapper; this is purely the visual status pill + button. */
export function AvailabilityToggle({
  available,
  busy,
  onToggle,
}: {
  available: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-xs font-semibold">
        <span className={`h-2 w-2 rounded-full ${available ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
        {available ? "En ligne" : "Hors ligne"}
      </span>
      <Button
        size="sm"
        variant={available ? "outline" : "default"}
        disabled={busy}
        onClick={onToggle}
        className="h-9 rounded-full px-4"
      >
        <Power className="mr-1.5 h-3.5 w-3.5" />
        {available ? "Passer hors ligne" : "Devenir disponible"}
      </Button>
    </div>
  );
}
