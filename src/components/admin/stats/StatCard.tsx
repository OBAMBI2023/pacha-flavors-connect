import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  comparisonPct,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  comparisonPct?: number | null;
  hint?: string;
  /** Optional small colored icon block (visual_language.kpi_cards.icon). Every existing call site omits this and keeps rendering exactly as before. */
  icon?: LucideIcon;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
      {Icon ? (
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        </div>
      ) : (
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      )}
      <p className="mt-2 truncate font-display text-xl font-semibold sm:text-[1.75rem]">{value}</p>
      {comparisonPct !== undefined && comparisonPct !== null && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
            comparisonPct >= 0 ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {comparisonPct >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {comparisonPct >= 0 ? "+" : ""}
            {comparisonPct.toFixed(1)}% vs période précédente
          </span>
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
