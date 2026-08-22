-- driver_profiles_restrict_self_update is a trigger function only (it reads
-- old/new, which only exist in a trigger context, so a direct RPC call
-- already errors at the Postgres level) -- revoking EXECUTE just matches
-- the same internal-only convention as the other dispatch functions and
-- removes it from the exposed RPC surface entirely.
revoke all on function public.driver_profiles_restrict_self_update() from public, anon, authenticated;
