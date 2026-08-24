-- SAOVIA Delivery Phase 2B -- pickup_points CRUD + organization delivery
-- reads. pickup_points already has RLS (has_organization_access), these
-- RPCs are convenience wrappers matching this session's established
-- typed-wrapper pattern (mirrors driver management's admin RPCs), not new
-- security boundaries -- the underlying table RLS is still the real gate.
create or replace function public.list_organization_pickup_points(p_organization_id uuid)
returns setof public.pickup_points
language sql
stable
security definer
set search_path to ''
as $function$
  select pp.* from public.pickup_points pp
  where pp.organization_id = p_organization_id
    and public.has_organization_access(p_organization_id)
  order by pp.created_at desc;
$function$;

create or replace function public.create_pickup_point(
  p_organization_id uuid, p_name text, p_address text,
  p_latitude double precision default null, p_longitude double precision default null,
  p_contact_name text default null, p_contact_phone text default null
)
returns public.pickup_points
language plpgsql
security definer
set search_path to ''
as $function$
declare v_row public.pickup_points;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_organization_access(p_organization_id) then raise exception 'Forbidden'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'Le nom du point de collecte est requis'; end if;
  if p_address is null or btrim(p_address) = '' then raise exception 'L''adresse est requise'; end if;

  insert into public.pickup_points (organization_id, name, address, latitude, longitude, contact_name, contact_phone)
  values (p_organization_id, btrim(p_name), btrim(p_address), p_latitude, p_longitude,
          nullif(btrim(coalesce(p_contact_name, '')), ''), nullif(btrim(coalesce(p_contact_phone, '')), ''))
  returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.update_pickup_point(
  p_pickup_point_id uuid, p_name text, p_address text,
  p_latitude double precision default null, p_longitude double precision default null,
  p_contact_name text default null, p_contact_phone text default null, p_is_active boolean default true
)
returns public.pickup_points
language plpgsql
security definer
set search_path to ''
as $function$
declare v_org_id uuid; v_row public.pickup_points;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select organization_id into v_org_id from public.pickup_points where id = p_pickup_point_id;
  if v_org_id is null then raise exception 'Point de collecte introuvable'; end if;
  if not public.has_organization_access(v_org_id) then raise exception 'Forbidden'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'Le nom du point de collecte est requis'; end if;
  if p_address is null or btrim(p_address) = '' then raise exception 'L''adresse est requise'; end if;

  update public.pickup_points set
    name = btrim(p_name), address = btrim(p_address), latitude = p_latitude, longitude = p_longitude,
    contact_name = nullif(btrim(coalesce(p_contact_name, '')), ''), contact_phone = nullif(btrim(coalesce(p_contact_phone, '')), ''),
    is_active = coalesce(p_is_active, true)
  where id = p_pickup_point_id
  returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.delete_pickup_point(p_pickup_point_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select organization_id into v_org_id from public.pickup_points where id = p_pickup_point_id;
  if v_org_id is null then raise exception 'Point de collecte introuvable'; end if;
  if not public.has_organization_access(v_org_id) then raise exception 'Forbidden'; end if;
  delete from public.pickup_points where id = p_pickup_point_id;
end;
$function$;

revoke all on function public.list_organization_pickup_points(uuid) from public, anon;
revoke all on function public.create_pickup_point(uuid, text, text, double precision, double precision, text, text) from public, anon;
revoke all on function public.update_pickup_point(uuid, text, text, double precision, double precision, text, text, boolean) from public, anon;
revoke all on function public.delete_pickup_point(uuid) from public, anon;
grant execute on function public.list_organization_pickup_points(uuid) to authenticated;
grant execute on function public.create_pickup_point(uuid, text, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.update_pickup_point(uuid, text, text, double precision, double precision, text, text, boolean) to authenticated;
grant execute on function public.delete_pickup_point(uuid) to authenticated;

-- Organization delivery reads -- setof deliveries, gated by
-- has_organization_access the same way the underlying table's own RLS
-- already gates direct .from('deliveries').select() reads. These RPCs
-- exist for convenience (matches this session's typed-wrapper convention),
-- not as a separate security boundary.
create or replace function public.list_organization_deliveries(p_organization_id uuid)
returns setof public.deliveries
language sql
stable
security definer
set search_path to ''
as $function$
  select d.* from public.deliveries d
  where d.organization_id = p_organization_id
    and public.has_organization_access(p_organization_id)
  order by d.created_at desc;
$function$;

create or replace function public.get_organization_delivery(p_delivery_id uuid)
returns public.deliveries
language sql
stable
security definer
set search_path to ''
as $function$
  select d.* from public.deliveries d
  where d.id = p_delivery_id
    and public.has_organization_access(d.organization_id);
$function$;

revoke all on function public.list_organization_deliveries(uuid) from public, anon;
revoke all on function public.get_organization_delivery(uuid) from public, anon;
grant execute on function public.list_organization_deliveries(uuid) to authenticated;
grant execute on function public.get_organization_delivery(uuid) to authenticated;
