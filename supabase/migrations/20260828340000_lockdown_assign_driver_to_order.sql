-- assign_driver_to_order is an admin-only action (unlike create_order,
-- which legitimately needs anon access for guest checkout) -- the function
-- already guards on auth.uid() is null, but explicitly revoking the default
-- PUBLIC execute grant is the same defense-in-depth already applied to
-- resolve_promo_code and the promo-code trigger functions.
revoke all on function public.assign_driver_to_order(uuid, uuid) from public, anon;
grant execute on function public.assign_driver_to_order(uuid, uuid) to authenticated;
