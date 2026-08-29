-- Driver account lifecycle: replaces the previous "admin sets a temp
-- password and reads it once" model with a real invite/activation flow
-- (admin never sees a password; the driver sets their own via a Supabase
-- Auth invite/recovery link). `driver_profiles.id = auth.users(id)` already
-- IS this project's "LIVREUR role" (see 20260827000000_phase7_driver_dispatch
-- comment) -- these columns are pure bookkeeping for the admin UI, not a
-- second role/permission system.

alter table public.driver_profiles
  add column account_status text not null default 'pending_invitation'
    check (account_status in ('pending_invitation', 'active')),
  add column invited_at timestamptz;

-- Backfill: any driver row created before this migration already has a
-- usable password-based account (the old admin-create-driver flow set one
-- directly), so it's "active", not "pending_invitation".
update public.driver_profiles set account_status = 'active';

-- A driver may flip their own account_status from pending -> active (the
-- activation page does this right after they set their password) but must
-- never touch invited_at or move status backward -- that stays
-- admin/service-role only (resend-invite updates invited_at via the
-- caller's own owner/manager-scoped client, not via this self path).
create or replace function public.driver_profiles_restrict_self_update() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_restaurant_role(old.restaurant_id, array['owner', 'manager']::public.restaurant_role[]) then
    new.full_name := old.full_name;
    new.phone := old.phone;
    new.is_active := old.is_active;
    new.restaurant_id := old.restaurant_id;
    new.invited_at := old.invited_at;
    if not (old.account_status = 'pending_invitation' and new.account_status = 'active') then
      new.account_status := old.account_status;
    end if;
  end if;
  return new;
end;
$$;

-- Resolves "email already used" / "compte Auth existe mais profil driver
-- absent" from admin-create-driver without giving the edge function (or
-- anyone else) general read access to auth.users. Locked to service_role
-- only, exactly like the existing dispatch RPCs are locked to their own
-- narrow callers.
create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
