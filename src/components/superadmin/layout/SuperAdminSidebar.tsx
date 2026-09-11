import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SuperAdminNavList } from "./SuperAdminNavList";

/**
 * Width (272px, `w-[272px]`) is duplicated as `lg:pl-[272px]` on the content
 * wrapper in `super-admin.tsx` -- Tailwind's arbitrary values must stay as
 * literal class strings for the JIT scanner, so keep both in sync by hand.
 *
 * `fixed inset-y-0` (not `sticky`) so the sidebar's own box height is always
 * the real viewport height, independent of the content column's height --
 * inside the previous `lg:flex` row, a sticky aside stretched to match its
 * (much taller) content sibling and could scroll out of view entirely.
 * Only the nav list in the middle scrolls; the logo and the profile/logout
 * footer are separate shrink-0 sections so they never scroll away.
 */
export function SuperAdminSidebar({
  pathname,
  hash,
  email,
  onLogout,
}: {
  pathname: string;
  hash: string;
  email: string;
  onLogout: () => void;
}) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[272px] lg:flex-col lg:border-r lg:border-white/[0.06] lg:bg-[color:var(--sa-navy)]">
      <div className="shrink-0 px-6 pt-7 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--sa-blue)] text-sm font-bold text-white shadow-lg shadow-blue-950/40">
            S
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">SAOVIA</p>
            <p className="text-[0.7rem] font-medium text-slate-400">Super Admin</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-4">
        <SuperAdminNavList pathname={pathname} hash={hash} />
      </div>

      <div className="shrink-0 space-y-3 border-t border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--sa-blue)]/15 text-sm font-semibold text-blue-300">
            {email.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{email}</p>
            <p className="text-xs text-slate-500">Super Admin</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Se déconnecter
        </Button>
      </div>
    </aside>
  );
}
