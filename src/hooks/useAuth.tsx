import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ProfileRow = {
  id: string;
  is_super_admin: boolean | null;
};

type MembershipRow = {
  id: string;
  user_id: string;
  restaurant_id: string;
  role: "owner" | "manager" | "staff";
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      const userId = session?.user?.id;
      if (!userId) {
        setProfile(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data: profileData }, { data: membershipData }] = await Promise.all([
        supabase.from("profiles").select("id,is_super_admin").eq("id", userId).maybeSingle(),
        supabase
          .from("restaurant_memberships")
          .select("id,user_id,restaurant_id,role")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setProfile((profileData as ProfileRow | null) ?? null);
      setMembership((membershipData as MembershipRow | null) ?? null);
      setLoading(false);
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const user: User | null = session?.user ?? null;
  const role = membership?.role ?? null;
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isStaff = role === "staff";
  const isSuperAdmin = Boolean(profile?.is_super_admin);
  const restaurantId = membership?.restaurant_id ?? null;
  const canManageMenu = isSuperAdmin || isOwner || isManager;

  return useMemo(
    () => ({
      session,
      user,
      loading,
      profile,
      membership,
      role,
      isOwner,
      isManager,
      isStaff,
      isSuperAdmin,
      restaurantId,
      canManageMenu,
    }),
    [canManageMenu, isManager, isOwner, isStaff, isSuperAdmin, loading, membership, profile, restaurantId, role, session, user],
  );
}
