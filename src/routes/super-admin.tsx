import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type SuperAdminProfile = {
  id: string;
  is_super_admin: boolean | null;
};

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  component: SuperAdminLayout,
});

function SuperAdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, navigate, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("id,is_super_admin").eq("id", user.id).maybeSingle();
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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">SAOVIA</p>
          <h1 className="mt-3 text-2xl font-semibold">Acces refuse</h1>
          <p className="mt-2 text-sm text-slate-300">
            Votre compte n&apos;a pas les droits super_admin.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/" className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100">
              Retour au site
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              Se deconnecter
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(180deg,#08111f_0%,#0b1220_45%,#f8fafc_45%,#f8fafc_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-white/10 bg-slate-950/95 p-5 text-slate-100 shadow-2xl shadow-black/25">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">SAOVIA</p>
            <h1 className="mt-3 text-2xl font-semibold">Super Admin</h1>
            <p className="mt-2 text-sm text-slate-300">{user.email}</p>
          </div>
          <nav className="mt-8 space-y-2 text-sm">
            <Link to="/super-admin" hash="overview" className="block rounded-2xl bg-white/10 px-4 py-3 text-white">Vue d&apos;ensemble</Link>
            <Link to="/super-admin" hash="restaurants" className="block rounded-2xl px-4 py-3 text-slate-300 hover:bg-white/5 hover:text-white">Restaurants</Link>
            <Link to="/super-admin" hash="subscriptions" className="block rounded-2xl px-4 py-3 text-slate-300 hover:bg-white/5 hover:text-white">Abonnements</Link>
            <Link to="/super-admin" hash="settings" className="block rounded-2xl px-4 py-3 text-slate-300 hover:bg-white/5 hover:text-white">Parametres</Link>
          </nav>
          <div className="mt-8 border-t border-white/10 pt-4">
            <Button
              variant="outline"
              className="w-full border-white/15 bg-transparent text-slate-100 hover:bg-white/10"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              Se deconnecter
            </Button>
          </div>
        </aside>
        <div className="space-y-6">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
