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
  // Distinguishes "haven't restored the persisted session yet" from
  // "restored it and there genuinely isn't one" -- both look like
  // `session === null` on the very first render, since getSession() below
  // is async and resolves after this hook's initial mount.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // TEMP DEBUG -- remove once the /auth -> /admin session-loss issue is
    // confirmed diagnosed. Never logs token values, only which sb-* keys
    // exist in localStorage at the moment useAuth mounts on this route.
    if (typeof window !== "undefined") {
      const sbKeys = Object.keys(window.localStorage).filter((k) => k.startsWith("sb-"));
      console.log("[session-debug] useAuth mount", {
        path: window.location.pathname,
        sbKeysPresent: sbKeys,
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      console.log("[session-debug] onAuthStateChange", {
        path: typeof window === "undefined" ? "server" : window.location.pathname,
        event,
        hasSession: Boolean(next),
        userId: next?.user?.id ?? null,
      });
      setSession(next);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      console.log("[session-debug] useAuth getSession()", {
        path: typeof window === "undefined" ? "server" : window.location.pathname,
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id ?? null,
        error: error ? { message: error.message } : null,
      });
      setSession(data.session);
      setSessionChecked(true);
    });

    supabase.auth.getUser().then(({ data, error }) => {
      console.log("[session-debug] useAuth getUser()", {
        path: typeof window === "undefined" ? "server" : window.location.pathname,
        userId: data.user?.id ?? null,
        error: error ? { message: error.message, status: (error as { status?: number }).status } : null,
      });
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      const userId = session?.user?.id;
      if (!userId) {
        // Still waiting on the initial getSession() restore -- session===null
        // here doesn't yet mean "logged out", so don't report loading=false
        // (and let a route guard bounce the user away) until it settles.
        if (!sessionChecked) return;
        setProfile(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [
        { data: profileData, error: profileError },
        { data: membershipData, error: membershipError },
      ] = await Promise.all([
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

      // TEMP DEBUG -- remove once the Food Partner dashboard redirect issue
      // is confirmed diagnosed. Never logs tokens/passwords.
      console.log("[partner-auth-debug] useAuth.loadAccess", {
        userId,
        profileData,
        profileError: profileError ? { message: profileError.message, code: profileError.code } : null,
        membershipData,
        membershipError: membershipError ? { message: membershipError.message, code: membershipError.code } : null,
      });

      if (cancelled) return;
      setProfile((profileData as ProfileRow | null) ?? null);
      setMembership((membershipData as MembershipRow | null) ?? null);
      setLoading(false);
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, sessionChecked]);

  const user: User | null = session?.user ?? null;
  const role = membership?.role ?? null;
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isStaff = role === "staff";
  const isSuperAdmin = Boolean(profile?.is_super_admin);
  const restaurantId = membership?.restaurant_id ?? null;
  const canManageMenu = isSuperAdmin || isOwner || isManager;

  // TEMP DEBUG -- remove once the Food Partner dashboard redirect issue is
  // confirmed diagnosed. Never logs tokens/passwords.
  useEffect(() => {
    console.log("[partner-auth-debug] useAuth state", {
      hasSession: Boolean(session),
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      loading,
      role,
      restaurantId,
      canManageMenu,
    });
  }, [session, user, loading, role, restaurantId, canManageMenu]);

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
