import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DateRange } from "@/lib/marketing";
import { CRM_PERIOD_LABELS, CRM_PERIOD_PRESETS, type CrmPeriodPreset } from "./crmPeriods";

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CrmPeriodPicker({
  preset,
  customRange,
  onChange,
}: {
  preset: CrmPeriodPreset;
  customRange: DateRange | undefined;
  onChange: (preset: CrmPeriodPreset, customRange?: DateRange) => void;
}) {
  const [draftFrom, setDraftFrom] = useState(() =>
    toDateInputValue(customRange?.start ?? new Date()),
  );
  const [draftTo, setDraftTo] = useState(() => toDateInputValue(customRange?.end ?? new Date()));

  function applyCustom() {
    const start = new Date(`${draftFrom}T00:00:00`);
    const end = new Date(`${draftTo}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return;
    onChange("custom", { start, end });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CRM_PERIOD_PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            preset === p
              ? "border-primary bg-primary text-primary-foreground"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {CRM_PERIOD_LABELS[p]}
        </button>
      ))}
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <Input
            type="date"
            value={draftFrom}
            max={draftTo}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="h-9 w-auto"
          />
          <span className="text-xs text-slate-400">→</span>
          <Input
            type="date"
            value={draftTo}
            min={draftFrom}
            onChange={(e) => setDraftTo(e.target.value)}
            className="h-9 w-auto"
          />
          <Button type="button" size="sm" className="h-9" onClick={applyCustom}>
            Appliquer
          </Button>
        </div>
      )}
    </div>
  );
}
