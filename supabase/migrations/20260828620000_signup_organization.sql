-- SAOVIA Delivery Phase 2B -- self-service organization signup. SECURITY
-- DEFINER is the sanctioned bypass of organizations' super-admin-only write
-- RLS, same justification as super_admin_create_tenant/admin-create-driver:
-- a real invariant (a new org must get exactly one owner membership,
-- atomically) that RLS alone cannot express. Caller must already have a
-- real Supabase Auth session (auth.signUp on the client, before calling
-- this) -- this RPC only wires that user to a brand-new organization.
create or replace function public.signup_organization(p_name text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org_id uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Le nom de l''organisation est requis';
  end if;
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'L''identifiant de l''organisation est requis';
  end if;

  -- Defensive normalization -- this is a public self-service entry point,
  -- unlike super_admin_create_tenant's slug (trusted, admin-typed).
  v_slug := lower(btrim(p_slug));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    raise exception 'L''identifiant de l''organisation est invalide';
  end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;

  begin
    insert into public.organizations (name, slug, status)
    values (btrim(p_name), v_slug, 'active')
    returning id into v_org_id;
  exception when unique_violation then
    raise exception 'Cet identifiant d''organisation est déjà utilisé';
  end;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (v_org_id, auth.uid(), 'owner', 'active');

  return jsonb_build_object('organization_id', v_org_id, 'slug', v_slug);
end;
$function$;

revoke all on function public.signup_organization(text, text) from public, anon;
grant execute on function public.signup_organization(text, text) to authenticated;
