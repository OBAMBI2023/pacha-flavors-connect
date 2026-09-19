-- Fixes device/account reassignment on fcm_device_tokens: UNIQUE(token) plus
-- register_fcm_token()'s ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id
-- meant a physical device re-authenticating as a different account silently
-- overwrote the previous account's row (same token, new owner) instead of
-- leaving a clean audit trail of "this device now belongs to someone else."
-- Root cause, not a cross-tenant leak: user_id was always correctly resolved
-- upstream by notify_restaurant_new_order() via restaurant_memberships (see
-- 20260918120000_tenant_order_notifications_toggle.sql) -- see the read-only
-- audit that preceded this migration. This only hardens device/account
-- bookkeeping so a stale registration is explicitly deactivated rather than
-- silently reassigned.
--
-- device_id (Capacitor Device.getId().identifier -- stable per app
-- installation, independent of the Firebase token which rotates) lets a
-- single physical device hold one row per account it has ever logged into,
-- instead of collapsing to a single row keyed by token alone.
--
-- Nothing here touches push_subscriptions (Web Push), notification_events,
-- send-notification's Realtime broadcast, or restaurant_memberships-based
-- recipient resolution.

alter table public.fcm_device_tokens
  add column if not exists device_id text;

-- device_id is nullable so the one existing row (registered before this
-- migration) keeps working untouched; it gets a real device_id the next time
-- that device's app registers (INITIAL_SESSION / tokenReceived) -- no blind
-- backfill here (we cannot know a device_id we never captured), but
-- register_fcm_token() below does bridge it deterministically the moment
-- that device proves its identity by presenting the same token again.

alter table public.fcm_device_tokens drop constraint fcm_device_tokens_token_key;

alter table public.fcm_device_tokens
  add constraint fcm_device_tokens_user_device_key unique (user_id, device_id);

create index if not exists fcm_device_tokens_token_idx on public.fcm_device_tokens (token);

-- Signature changes (new required p_device_id param) -- old 3-arg overload
-- must be dropped explicitly or it lingers alongside the new one, same
-- "drop stale overload" convention already used elsewhere in this schema
-- (e.g. 20260828080000_drop_stale_create_order_overload_offers.sql).
drop function if exists public.register_fcm_token(text, text, text);

create or replace function public.register_fcm_token(
  p_token text,
  p_device_id text,
  p_platform text default 'android',
  p_device_name text default null
) returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Token FCM requis';
  end if;
  if p_device_id is null or btrim(p_device_id) = '' then
    raise exception 'device_id requis';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'Plateforme invalide';
  end if;

  -- Both deactivations below run unconditionally, before the legacy "same
  -- user" branch further down that returns early. This is what closes the
  -- "A legacy -> B -> A" gap: when A comes back and gets migrated in place
  -- onto p_device_id, whoever is currently active on that same physical
  -- device (B) must already be deactivated by that point, or A and B would
  -- both end up active on the same device_id at once.

  -- This physical device just authenticated as a different account --
  -- deactivate any other account's row for it immediately rather than
  -- leaving an ambiguous/ stale registration around (the bug the read-only
  -- audit flagged: previously ON CONFLICT(token) silently reassigned
  -- user_id, which worked but left no trace of the prior owner having lost
  -- its live registration).
  update public.fcm_device_tokens
  set is_active = false
  where device_id = p_device_id
    and user_id <> auth.uid();

  -- Legacy bridge, "different user" half: a legacy NULL-device_id row (see
  -- 20260919120000_fcm_device_tokens.sql, the single prod row at the time
  -- this migration was written) is holding the exact token this call
  -- presents but belongs to someone else -- that device changed hands
  -- before device_id existed. Deactivate the legacy row itself (never
  -- delete, never reassign). Harmless no-op if it doesn't apply.
  update public.fcm_device_tokens
  set is_active = false
  where device_id is null
    and token = p_token
    and user_id <> auth.uid();

  -- Legacy bridge, "same user" half: this call's token matches a legacy row
  -- already owned by auth.uid() -- token equality is the only trustworthy,
  -- non-guessed signal that it's the same physical device+install (Firebase
  -- issues one token per installation). Migrate that row in place to carry
  -- the real device_id for the first time, rather than creating a second
  -- row -- runs after both deactivations above so any prior occupant of
  -- p_device_id is already gone before this row becomes the active one. A
  -- legacy row whose token doesn't match this call is left untouched: if
  -- the token also rotated before device_id was ever captured, there is no
  -- data-driven way to link the two rows, and none is fabricated here.
  if exists (
    select 1 from public.fcm_device_tokens
    where device_id is null and token = p_token and user_id = auth.uid()
  ) then
    update public.fcm_device_tokens
    set device_id = p_device_id,
        platform = p_platform,
        device_name = coalesce(p_device_name, device_name),
        is_active = true,
        last_seen_at = now()
    where device_id is null and token = p_token and user_id = auth.uid();
    return;
  end if;

  insert into public.fcm_device_tokens (user_id, device_id, token, platform, device_name, is_active, last_seen_at)
  values (auth.uid(), p_device_id, p_token, p_platform, p_device_name, true, now())
  on conflict (user_id, device_id) do update set
    token = excluded.token,
    platform = excluded.platform,
    device_name = coalesce(excluded.device_name, public.fcm_device_tokens.device_name),
    is_active = true,
    last_seen_at = now();
end;
$function$;

revoke all on function public.register_fcm_token(text, text, text, text) from public;
grant execute on function public.register_fcm_token(text, text, text, text) to authenticated;
