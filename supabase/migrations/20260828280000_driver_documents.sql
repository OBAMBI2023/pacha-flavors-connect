-- New table -- no document/license entity existed anywhere before this.
-- One row per (driver, kind): identity document, driving license. Vehicle
-- insurance/inspection expiry live on vehicles (already added), not
-- duplicated here -- those are vehicle attributes, not driver documents.
create type public.driver_document_kind as enum ('identity', 'license');

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  kind driver_document_kind not null,
  document_type text check (document_type in ('cni', 'passeport', 'carte_consulaire', 'autre')),
  document_number text,
  category text,
  issued_at date,
  expires_at date,
  front_path text,
  back_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index driver_documents_one_per_kind on public.driver_documents (driver_id, kind);
create index driver_documents_restaurant_id_idx on public.driver_documents (restaurant_id);

create trigger driver_documents_set_updated_at
  before update on public.driver_documents
  for each row execute function public.set_updated_at();

alter table public.driver_documents enable row level security;

-- Deliberately tighter than driver_profiles/vehicles: ID and license scans
-- are sensitive, so SELECT is owner/manager only (staff excluded), unlike
-- driver_profiles/vehicles which are staff-readable.
create policy driver_documents_manage_owner_manager on public.driver_documents
  for all
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]));
