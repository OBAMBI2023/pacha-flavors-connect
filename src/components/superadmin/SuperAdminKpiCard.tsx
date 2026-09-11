import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SuperAdminKpiCard({
  icon: Icon,
  label,
  value,
  accent = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Purely cosmetic icon-chip tint -- does not affect the underlying data. */
  accent?: "blue" | "emerald" | "amber" | "red" | "violet";
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          accent === "blue" && "bg-blue-50 text-[color:var(--sa-blue)]",
          accent === "emerald" && "bg-emerald-50 text-emerald-600",
          accent === "amber" && "bg-amber-50 text-amber-600",
          accent === "red" && "bg-red-50 text-red-600",
          accent === "violet" && "bg-violet-50 text-violet-600",
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
