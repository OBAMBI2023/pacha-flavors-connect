import { Link } from "@tanstack/react-router";
import { Calendar, ExternalLink, Eye, Mail, MoreHorizontal, Power, User } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_THEME } from "@/lib/theme";
import type { TenantRow } from "@/lib/superAdminTenants";
import { isRecentlyCreated, TenantNewBadge, TenantStatusBadge } from "./TenantStatusBadge";

function TenantActionsMenu({
  tenant,
  onToggleStatus,
}: {
  tenant: TenantRow;
  onToggleStatus: (tenant: TenantRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Actions"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link to="/super-admin/restaurants/$restaurantId" params={{ restaurantId: tenant.id }}>
            <Eye className="mr-2 h-4 w-4" /> Voir la fiche
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleStatus(tenant)}>
          <Power className="mr-2 h-4 w-4" />{" "}
          {tenant.status === "suspended" ? "Activer" : "Désactiver"}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/r/${tenant.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> Ouvrir le site
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TenantAvatarFallback({ tenant }: { tenant: TenantRow }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white"
      style={{ backgroundColor: tenant.primary_color ?? DEFAULT_THEME.primary_color ?? "#2563eb" }}
    >
      {tenant.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function TenantAvatar({ tenant }: { tenant: TenantRow }) {
  const [imgError, setImgError] = useState(false);

  if (tenant.logo_url && !imgError) {
    return (
      <img
        src={tenant.logo_url}
        alt=""
        loading="lazy"
        onError={() => setImgError(true)}
        className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
      />
    );
  }

  return <TenantAvatarFallback tenant={tenant} />;
}

export function TenantsTable({
  tenants,
  startIndex,
  loading,
  onToggleStatus,
}: {
  tenants: TenantRow[];
  startIndex: number;
  loading: boolean;
  onToggleStatus: (tenant: TenantRow) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.15em] text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3">#</th>
              <th className="min-w-[240px] px-4 py-3">Restaurant</th>
              <th className="px-4 py-3">Administrateur</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Thème</th>
              <th className="px-4 py-3">Inscription</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  Aucun tenant.
                </td>
              </tr>
            )}
            {!loading &&
              tenants.map((tenant, i) => (
                <tr key={tenant.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-4 text-slate-400">{startIndex + i + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <TenantAvatar tenant={tenant} />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-slate-900">
                          {tenant.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">/r/{tenant.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{tenant.owner_name ?? "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{tenant.owner_email ?? "-"}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TenantStatusBadge status={tenant.status} />
                      {isRecentlyCreated(tenant.created_at) && <TenantNewBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-slate-300"
                      style={{
                        backgroundColor:
                          tenant.primary_color ?? DEFAULT_THEME.primary_color ?? undefined,
                      }}
                      title={tenant.primary_color ? "Thème personnalisé" : "Thème par défaut"}
                    />
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(tenant.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <TenantActionsMenu tenant={tenant} onToggleStatus={onToggleStatus} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="divide-y divide-slate-200 sm:hidden">
        {loading && <p className="px-4 py-6 text-sm text-slate-500">Chargement...</p>}
        {!loading && tenants.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">Aucun tenant.</p>
        )}
        {!loading &&
          tenants.map((tenant) => (
            <div key={tenant.id} className="flex items-start gap-3 bg-white p-4">
              <TenantAvatar tenant={tenant} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-slate-900">
                      {tenant.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">/r/{tenant.slug}</p>
                  </div>
                  <TenantActionsMenu tenant={tenant} onToggleStatus={onToggleStatus} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <TenantStatusBadge status={tenant.status} />
                  {isRecentlyCreated(tenant.created_at) && <TenantNewBadge />}
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5 truncate">
                    <User className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{tenant.owner_name ?? "-"}</span>
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{tenant.owner_email ?? "-"}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    {new Date(tenant.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
