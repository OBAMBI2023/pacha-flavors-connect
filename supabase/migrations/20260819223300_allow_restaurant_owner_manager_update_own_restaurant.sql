-- restaurant_categories, restaurant_products, and restaurant_settings all grant
-- owner/manager members an ALL policy via has_restaurant_role(). The parent
-- restaurants table only had restaurants_update_super_admin, so tenant owners
-- could never persist their own name/logo_url/cover_url/contact edits: the
-- admin UI's .update().eq('id', rid) call succeeded with 0 rows affected
-- (RLS silently filters, PostgREST reports no error), producing a false
-- "saved" toast while the row never changed.

create policy restaurants_update_owner_manager
on public.restaurants
for update
to authenticated
using (public.has_restaurant_role(id, array['owner', 'manager']::public.restaurant_role[]))
with check (public.has_restaurant_role(id, array['owner', 'manager']::public.restaurant_role[]));
