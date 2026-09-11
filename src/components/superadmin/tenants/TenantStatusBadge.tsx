import { cn } from "@/lib/utils";
import type { RestaurantStatus } from "@/lib/superAdminTenants";

const STATUS_LABEL: Record<RestaurantStatus, string> = {
  trial: "Essai",
  active: "Actif",
  suspended: "Suspendu",
  archived: "Archivé",
};

const STATUS_CLASSES: Record<RestaurantStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  trial: "bg-amber-50 text-amber-700 ring-amber-600/15",
  suspended: "bg-red-50 text-red-700 ring-red-600/15",
  archived: "bg-slate-100 text-slate-600 ring-slate-500/15",
};

export function TenantStatusBadge({ status }: { status: RestaurantStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ring-1 ring-inset",
        STATUS_CLASSES[status],
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active" && "bg-emerald-500",
          status === "trial" && "bg-amber-500",
          status === "suspended" && "bg-red-500",
          status === "archived" && "bg-slate-400",
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Purely visual "new" chip derived from created_at (<=7 days) -- not a stored status. */
export function TenantNewBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-[color:var(--sa-blue)]/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[color:var(--sa-blue)]">
      Nouveau
    </span>
  );
}

export function isRecentlyCreated(createdAt: string): boolean {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() >= weekAgo;
}
