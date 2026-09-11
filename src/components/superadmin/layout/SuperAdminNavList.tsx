import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { SUPER_ADMIN_NAV } from "./navConfig";
import { isSuperAdminNavItemActive } from "./navActive";

export function SuperAdminNavList({
  pathname,
  hash,
  onNavigate,
}: {
  pathname: string;
  hash: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-6">
      {SUPER_ADMIN_NAV.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isSuperAdminNavItemActive(item, pathname, hash);

              if (!item.to) {
                return (
                  <div
                    key={item.label}
                    className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500">
                      Bientôt
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  to={item.to}
                  {...(item.hash ? { hash: item.hash } : {})}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[color:var(--sa-blue)] text-white shadow-sm shadow-blue-950/30"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-500")}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
