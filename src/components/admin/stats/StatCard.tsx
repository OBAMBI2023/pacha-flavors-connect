import { TrendingDown, TrendingUp } from "lucide-react";

export function StatCard({
  label,
  value,
  comparisonPct,
  hint,
}: {
  label: string;
  value: string;
  comparisonPct?: number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {comparisonPct !== undefined && comparisonPct !== null && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
            comparisonPct >= 0 ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {comparisonPct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {comparisonPct >= 0 ? "+" : ""}
          {comparisonPct.toFixed(1)}% vs période précédente
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
