-- Phase 6A security fixes
--
-- 1) CRITICAL: storage.objects policies for the `menu-images` bucket checked
--    only "is this user an active owner/manager of *some* restaurant",
--    never that the object's own path belongs to that restaurant. Any
--    tenant owner/manager could therefore insert/select/update/delete
--    objects under another tenant's `<restaurant_id>/...` prefix. Fixed by
--    correlating the first path segment (storage.foldername(name))[1] to
--    the membership's restaurant_id. Bucket stays public (unaffected -- the
--    public CDN read path (`/storage/v1/object/public/...`) does not
--    consult these table policies at all, only the authenticated
--    object-management API does), so Marketplace image display is
--    untouched.
--
-- 2) MEDIUM: `restaurants` has no SELECT policy for anon/public, so the
--    Marketplace directory (`fetchMarketplaceRestaurants`, a direct table
--    query) silently returned zero rows for real anonymous visitors. Fixed
--    with a dedicated public RPC, following the same SECURITY DEFINER /
--    locked search_path / is_public+status='active' filter pattern as the
--    existing `get_public_menu`, rather than opening a broad SELECT policy
--    on the tenant table itself.

-- ---------------------------------------------------------------------------
-- 1) Storage isolation for menu-images
-- ---------------------------------------------------------------------------

drop policy if exists menu_images_select_owner_manager on storage.objects;
create policy menu_images_select_owner_manager
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::public.restaurant_role, 'manager'::public.restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

drop policy if exists menu_images_insert_owner_manager on storage.objects;
create policy menu_images_insert_owner_manager
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::public.restaurant_role, 'manager'::public.restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

drop policy if exists menu_images_update_owner_manager on storage.objects;
create policy menu_images_update_owner_manager
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::public.restaurant_role, 'manager'::public.restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  )
  with check (
    bucket_id = 'menu-images'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::public.restaurant_role, 'manager'::public.restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

drop policy if exists menu_images_delete_owner_manager on storage.objects;
create policy menu_images_delete_owner_manager
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::public.restaurant_role, 'manager'::public.restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Public Marketplace restaurant directory
-- ---------------------------------------------------------------------------

create or replace function public.get_public_restaurants(p_query text default null)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'slug', r.slug,
        'name', r.name,
        'logo_url', r.logo_url,
        'cover_url', r.cover_url,
        'address', r.address,
        'commune', r.commune,
        'city', r.city
      )
      order by r.name asc
    ),
    '[]'::jsonb
  )
  from public.restaurants r
  where r.is_public = true
    and r.status = 'active'
    and (p_query is null or btrim(p_query) = '' or r.name ilike '%' || p_query || '%');
$$;

revoke all on function public.get_public_restaurants(text) from public;
grant execute on function public.get_public_restaurants(text) to anon, authenticated;
