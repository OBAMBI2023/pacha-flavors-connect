-- SAOVIA Delivery -- proof-of-delivery records and incident tracking.
-- `file_path` follows the same private-bucket-relative-path convention as
-- driver_documents (bucket creation + storage RLS is out of scope for this
-- DB-foundations-only migration; add a `delivery-proofs` bucket, mirroring
-- driver-documents' policies, when the capture flow ships).
create table public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  proof_type text not null check (proof_type in ('photo', 'signature', 'otp', 'other')),
  file_path text,
  signature_data text,
  notes text,
  captured_by uuid references public.driver_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index delivery_proofs_delivery_id_idx on public.delivery_proofs(delivery_id);

alter table public.delivery_proofs enable row level security;

create policy delivery_proofs_select_scoped on public.delivery_proofs
  for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    where d.id = delivery_id and public.has_organization_access(d.organization_id)
  ));

create policy delivery_proofs_manage_super_admin on public.delivery_proofs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.delivery_incidents (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  reported_by uuid references auth.users(id) on delete set null,
  incident_type text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'resolved', 'cancelled')),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_incidents_delivery_id_idx on public.delivery_incidents(delivery_id);
create index delivery_incidents_status_idx on public.delivery_incidents(status);

create trigger delivery_incidents_set_updated_at
  before update on public.delivery_incidents
  for each row execute function public.set_updated_at();

alter table public.delivery_incidents enable row level security;

create policy delivery_incidents_select_scoped on public.delivery_incidents
  for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    where d.id = delivery_id and public.has_organization_access(d.organization_id)
  ));

create policy delivery_incidents_manage_super_admin on public.delivery_incidents
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
