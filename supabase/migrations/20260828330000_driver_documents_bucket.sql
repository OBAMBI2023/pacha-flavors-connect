-- First PRIVATE bucket in this app (menu-images is the only existing one
-- and is public). Path convention: ${restaurant_id}/${driver_id}/profile/...,
-- .../vehicle/..., .../documents/... . Policies mirror menu_images_*_owner_manager
-- (role check joined on the first path segment = restaurant_id), except
-- documents/ reads are restricted to owner/manager only (ID/license scans),
-- while profile/ and vehicle/ reads are open to staff too (matches
-- driver_profiles/vehicles' own staff-readable bar). Reads must go through
-- createSignedUrl -- this bucket is never public, so getPublicUrl won't work.
insert into storage.buckets (id, name, public) values ('driver-documents', 'driver-documents', false);

create policy driver_documents_bucket_select_profile_vehicle on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[3] in ('profile', 'vehicle')
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::restaurant_role, 'manager'::restaurant_role, 'staff'::restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

create policy driver_documents_bucket_select_documents on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[3] = 'documents'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::restaurant_role, 'manager'::restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

create policy driver_documents_bucket_insert_owner_manager on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'driver-documents'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::restaurant_role, 'manager'::restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

create policy driver_documents_bucket_update_owner_manager on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'driver-documents'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::restaurant_role, 'manager'::restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );

create policy driver_documents_bucket_delete_owner_manager on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'driver-documents'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.restaurant_memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.role = any (array['owner'::restaurant_role, 'manager'::restaurant_role])
          and (storage.foldername(name))[1] = m.restaurant_id::text
      )
    )
  );
