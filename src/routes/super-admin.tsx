import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { SuperAdminSidebar } from "@/components/superadmin/layout/SuperAdminSidebar";
import { SuperAdminHeader } from "@/components/superadmin/layout/SuperAdminHeader";
import { SuperAdminMobileNav } from "@/components/superadmin/layout/SuperAdminMobileNav";
import { SUPER_ADMIN_NAV_FLAT } from "@/components/superadmin/layout/navConfig";
import { resolveSuperAdminPageTitle } from "@/components/superadmin/layout/navActive";

type SuperAdminProfile = {
  id: string;
  is_super_admin: boolean | null;
};

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  // No sub-route under /super-admin defines its own `robots` meta, so this
  // is inherited by all of them via TanStack Router's per-property head
  // merge (root -> this layout -> leaf route) -- verified against the built
  // output, see the noindex check in this phase's report.
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: SuperAdminLayout,
});

function SuperAdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, navigate, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,is_super_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const next = (data as SuperAdminProfile | null) ?? null;
      setAllowed(Boolean(next?.is_super_admin));
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <p className="p-10 text-sm text-muted-foreground">Chargement...</p>;
  if (!user) return null;
  if (!allowed) {
    return (
      <main className="super-admin-theme flex min-h-screen items-center justify-center bg-[color:var(--sa-navy)] px-4 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--sa-blue)]">
            SAOVIA
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Accès refusé</h1>
          <p className="mt-2 text-sm text-slate-300">
            Votre compte n&apos;a pas les droits super_admin.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              to="/"
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100"
            >
              Retour au site
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              Se déconnecter
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const email = user.email ?? "";
  const pageTitle = resolveSuperAdminPageTitle(
    SUPER_ADMIN_NAV_FLAT,
    location.pathname,
    location.hash,
  );

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="super-admin-theme min-h-screen bg-slate-50 text-slate-900">
      <Toaster />
      <SuperAdminSidebar
        pathname={location.pathname}
        hash={location.hash}
        email={email}
        onLogout={() => void logout()}
      />
      <SuperAdminMobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        pathname={location.pathname}
        hash={location.hash}
        email={email}
        onLogout={() => void logout()}
      />
      {/* lg:pl reserves the fixed sidebar's width -- the sidebar is `fixed`
          (out of flow), so this padding is what actually prevents overlap. */}
      <div className="min-w-0 lg:pl-[272px]">
        <SuperAdminHeader
          title={pageTitle}
          email={email}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onLogout={() => void logout()}
        />
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
