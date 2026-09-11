import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-any";

/**
 * Mirrors useAuth's shape but for organization_memberships instead of
 * restaurant_memberships -- kept separate rather than merged into useAuth
 * since org-only owners have no restaurant_id and no restaurant role, and
 * shoehorning both into one hook would complicate every existing call site.
 */
type OrganizationRow = { id: string; name: string; slug: string };

export function useOrganizationAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<OrganizationRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadOrg() {
      const userId = session?.user?.id;
      if (!userId) {
        setOrganization(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("organization_memberships")
        .select("organization_id, organizations(id,name,slug)")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const row = data as unknown as { organizations: OrganizationRow | null } | null;
      setOrganization(row?.organizations ?? null);
      setLoading(false);
    }
    void loadOrg();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const user: User | null = session?.user ?? null;

  return useMemo(
    () => ({ session, user, organization, loading }),
    [session, user, organization, loading],
  );
}
