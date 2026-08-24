-- SAOVIA Delivery -- organization-scoped audit trail. Closes the gap left
-- by create_delivery (an organization with no linked restaurant could never
-- get an audit_logs row, since restaurant_id was NOT NULL). Additive only:
-- log_audit_event() and its 13 existing call sites are untouched -- all of
-- them derive restaurant_id from an already-NOT-NULL orders/restaurant_settings/
-- reviews row, so relaxing the column's own NOT NULL constraint changes
-- nothing for any of them.
alter table public.audit_logs
  alter column restaurant_id drop not null;

alter table public.audit_logs
  add column organization_id uuid references public.organizations(id) on delete cascade;

-- Every row stays scoped to at least one tenant boundary -- never fully orphaned.
alter table public.audit_logs
  add constraint audit_logs_scope_check
  check (restaurant_id is not null or organization_id is not null);

-- Backfill via the Phase 1 1:1 restaurant<->organization mapping. Enriches
-- existing rows only -- never touches restaurant_id.
update public.audit_logs a
set organization_id = o.id
from public.organizations o
where o.restaurant_id = a.restaurant_id
  and a.organization_id is null;

create index audit_logs_organization_id_created_at_idx
  on public.audit_logs (organization_id, created_at desc);

-- Additive RLS policy -- SELECT policies on the same table combine with OR,
-- so this changes nothing for existing restaurant-scoped rows/readers.
create policy audit_logs_select_organization_scoped on public.audit_logs
  for select to authenticated
  using (organization_id is not null and public.has_organization_access(organization_id));

-- New function, not a modified log_audit_event() -- avoids the overload/
-- signature-change trap hit earlier in this project with create_order.
-- Same lockdown posture as log_audit_event(): no direct EXECUTE grant to
-- anyone, callable only from inside other SECURITY DEFINER functions.
create or replace function public.log_organization_audit_event(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
begin
  select restaurant_id into v_restaurant_id from public.organizations where id = p_organization_id;
  insert into public.audit_logs (restaurant_id, organization_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (v_restaurant_id, p_organization_id, p_actor_user_id, p_entity_type, p_entity_id, p_action, p_metadata);
end;
$function$;

revoke all on function public.log_organization_audit_event(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
