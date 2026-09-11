import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu as MenuIcon, Search } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The only real, globally-searchable entity available client-side is the
 * tenant list (fetchTenants() already powers name/slug/owner search on the
 * overview page). This input is a genuine search, not a placeholder:
 * submitting it (Enter / the search action) navigates to the tenants table
 * pre-filtered via the `q` search param (`/super-admin/`'s `validateSearch`),
 * reusing that page's existing filter logic instead of duplicating it here.
 *
 * Deliberately submit-only (no navigate-as-you-type debounce): this field is
 * rendered on every /super-admin/* page, so a value change from the browser's
 * own autofill (observed in testing -- Chrome can silently populate a bare
 * `type="search"` field from address/form-history) must never be able to
 * trigger navigation on its own. Only an explicit Enter/submit does.
 */
export function SuperAdminHeader({
  title,
  email,
  onOpenMobileNav,
  onLogout,
}: {
  title: string;
  email: string;
  onOpenMobileNav: () => void;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function submitSearch() {
    const q = value.trim();
    void navigate({ to: "/super-admin", search: q ? { q } : {}, hash: "tenants" });
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Ouvrir le menu"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 lg:hidden"
      >
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <h1 className="min-w-0 shrink-0 truncate text-lg font-semibold text-slate-900 sm:text-xl">
        {title}
      </h1>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
        className="relative ml-auto hidden w-full max-w-sm md:block"
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          name="super-admin-global-search"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Rechercher un restaurant, administrateur, email..."
          className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[color:var(--sa-blue)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--sa-blue)]/20"
        />
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:pr-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--sa-navy)] text-xs font-semibold text-white">
              {email.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="max-w-[10rem] truncate text-sm font-medium text-slate-700">
                {email}
              </span>
              <span className="text-[0.65rem] font-medium text-slate-400">Super Admin</span>
            </span>
            <ChevronDown
              className="hidden h-3.5 w-3.5 text-slate-400 sm:block"
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/">Retour au site</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
