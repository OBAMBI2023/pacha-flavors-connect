-- Phase 5 (SAOVIA Partner runtime), step 2: wires the pre-existing
-- push_subscriptions table (migration phase8_driver_push_architecture,
-- version 20260822110511 -- already present in production, NOT created or
-- altered by this migration: no CREATE TABLE, no ALTER, no policy changes)
-- to send-push via a fire-and-forget trigger on delivery_proposals.
--
-- Does not touch delivery_proposals' or orders' existing columns, RLS, or
-- any dispatch RPC (assign_driver_to_order / respond_to_proposal /
-- driver_advance_*).
--
-- File name/timestamp match this migration's actual applied version in
-- Supabase (20260825201401_delivery_proposals_notify_push_trigger) --
-- applied directly via the Supabase MCP apply_migration tool, not via the
-- local Supabase CLI, so this file was added to the repo after the fact to
-- keep history accurate rather than to drive the apply.

create extension if not exists pg_net;

-- Secret's VALUE is never a literal here, only its *name* is referenced --
-- the value was provisioned separately via vault.create_secret(...), not
-- part of this file.
create or replace function public.notify_delivery_proposal_push()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_secret text;
begin
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'send_push_trigger_secret'
    limit 1;

    if v_secret is not null then
      perform net.http_post(
        url := 'https://haamomdggdubdzsmbwoq.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-send-push-secret', v_secret
        ),
        body := jsonb_build_object(
          'proposal_id', new.id,
          'driver_id', new.driver_id,
          'order_id', new.order_id
        )
      );
    end if;
  exception when others then
    -- A broken/unreachable push pipeline must never block a real delivery
    -- proposal from being created. net.http_post() is already async/
    -- non-blocking by design; this is defense in depth on top of that.
    null;
  end;
  return new;
end;
$function$;

create trigger delivery_proposals_notify_push
  after insert on public.delivery_proposals
  for each row
  when (new.status = 'pending')
  execute function public.notify_delivery_proposal_push();
