import { useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PeriodPreset, PeriodRange } from "@/components/admin/stats/periodPresets";

/**
 * Orders-specific preset list -- deliberately not `PERIOD_PRESETS` from
 * periodPresets.ts (that array drives the Statistiques screen's own button
 * row and must stay exactly as it is). Same shared date math via
 * `resolvePeriod`, different, calendar-literal set of options for the
 * Commandes screen ("Cette semaine" / "Ce mois" rather than rolling windows).
 */
const ORDER_PERIOD_OPTIONS: { id: PeriodPreset; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "yesterday", label: "Hier" },
  { id: "thisWeek", label: "Cette semaine" },
  { id: "thisMonth", label: "Ce mois" },
  { id: "custom", label: "Personnalisée" },
];

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PeriodFilter({
  preset,
  customRange,
  onChange,
}: {
  preset: PeriodPreset;
  customRange: PeriodRange | undefined;
  onChange: (preset: PeriodPreset, customRange?: PeriodRange) => void;
}) {
  const [open, setOpen] = useState(false);
  // Tracks which row is highlighted/expanded *inside the open sheet*,
  // separate from the applied `preset` prop -- picking "Personnalisée" must
  // reveal the date fields immediately, before any date has been chosen and
  // before the parent's actual filter changes (that only happens on
  // "Appliquer", or immediately for every other option).
  const [draftPreset, setDraftPreset] = useState<PeriodPreset>(preset);
  const [draftFrom, setDraftFrom] = useState(() =>
    toDateInputValue(customRange?.start ?? new Date()),
  );
  const [draftTo, setDraftTo] = useState(() => toDateInputValue(customRange?.end ?? new Date()));

  const currentLabel = ORDER_PERIOD_OPTIONS.find((o) => o.id === preset)?.label ?? "Aujourd'hui";

  function openSheet() {
    setDraftPreset(preset);
    if (customRange) {
      setDraftFrom(toDateInputValue(customRange.start));
      setDraftTo(toDateInputValue(customRange.end));
    }
    setOpen(true);
  }

  function selectPreset(id: PeriodPreset) {
    setDraftPreset(id);
    if (id === "custom") return; // handled by the "Appliquer" button below, once dates are picked
    onChange(id);
    setOpen(false);
  }

  function applyCustom() {
    const start = new Date(`${draftFrom}T00:00:00`);
    const end = new Date(`${draftTo}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return;
    onChange("custom", { start, end });
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0 gap-1.5 rounded-xl"
        onClick={openSheet}
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {currentLabel}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Période</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-1">
            {ORDER_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectPreset(option.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors ${
                  draftPreset === option.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
                }`}
              >
                {option.label}
                {draftPreset === option.id && <Check className="h-4 w-4" aria-hidden="true" />}
              </button>
            ))}
            {draftPreset === "custom" && (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">
                    Date début
                    <Input
                      type="date"
                      value={draftFrom}
                      max={draftTo}
                      onChange={(e) => setDraftFrom(e.target.value)}
                      className="h-11"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">
                    Date fin
                    <Input
                      type="date"
                      value={draftTo}
                      min={draftFrom}
                      onChange={(e) => setDraftTo(e.target.value)}
                      className="h-11"
                    />
                  </label>
                </div>
                <Button type="button" className="h-11 w-full" onClick={applyCustom}>
                  Appliquer
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
