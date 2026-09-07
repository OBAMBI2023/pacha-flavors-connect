-- SAOVIA Food -- self-service restaurant signup (landing page "Essayer
-- gratuitement" flow). Mirrors signup_organization's already-sanctioned
-- pattern (SECURITY DEFINER bypass of restaurants'/restaurant_memberships'
-- owner-only write RLS): a new restaurant must get exactly one owner
-- membership and a real trial window, atomically -- an invariant RLS alone
-- can't express. Caller must already have a live Supabase Auth session
-- (auth.signUp on the client, before calling this) -- this RPC only wires
-- that user to a brand-new restaurant. It never accepts a restaurant id and
-- never updates an existing row, so it can't be used to attach a new
-- signup to LE PACHA RESTAURANT or any other existing tenant -- every call
-- inserts a fresh restaurants row.
--
-- Trial length: 14 days, chosen here as this RPC's own default (not yet a
-- documented commercial policy elsewhere) -- adjust v_trial_days below if
-- the business settles on a different number.
create or replace function public.signup_restaurant(p_name text, p_full_name text, p_phone text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_trial_days constant int := 14;
  v_phone text;
  v_full_name text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Le nom du restaurant est requis';
  end if;

  v_phone := nullif(btrim(p_phone), '');
  v_full_name := nullif(btrim(p_full_name), '');
  v_email := nullif(btrim(p_email), '');

  -- Same slugify shape as signup_organization -- lowercase, non-alphanumeric
  -- runs collapsed to a single hyphen, no leading/trailing hyphen. Unlike
  -- signup_organization, this form never asks the visitor for a slug, so
  -- collisions (two restaurants named "Le Bon Goût") are resolved silently
  -- below by appending -2, -3, ... rather than surfacing an error for a
  -- field the visitor never saw.
  v_base_slug := lower(btrim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'restaurant';
  end if;
  v_slug := v_base_slug;

  insert into public.profiles (id, full_name, phone)
  values (auth.uid(), v_full_name, v_phone)
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone);

  loop
    begin
      insert into public.restaurants (name, slug, phone, whatsapp_phone, email, status, trial_ends_at)
      values (btrim(p_name), v_slug, v_phone, v_phone, v_email, 'trial', now() + (v_trial_days || ' days')::interval)
      returning id into v_restaurant_id;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      exit when v_suffix > 50;
      v_slug := v_base_slug || '-' || v_suffix;
    end;
  end loop;

  if v_restaurant_id is null then
    raise exception 'Impossible de créer votre restaurant, réessayez';
  end if;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (v_restaurant_id, auth.uid(), 'owner', 'active');

  return jsonb_build_object('restaurant_id', v_restaurant_id, 'slug', v_slug);
end;
$function$;

revoke all on function public.signup_restaurant(text, text, text, text) from public, anon;
grant execute on function public.signup_restaurant(text, text, text, text) to authenticated;
