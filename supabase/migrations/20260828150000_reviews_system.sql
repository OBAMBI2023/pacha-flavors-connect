-- Reviews module. This app has no real customer accounts (guest checkout
-- only), so "customer_id -> users.id" from the spec is fictional here --
-- ownership is verified the same way every other customer-facing RPC in
-- this app already does it: order_id + exact customer_phone match (see
-- get_customer_order). visitor_id (the same anonymous browser identity
-- used by Offers/client_notifications) is captured only to route the
-- "tenant replied" notification back to the right browser, never for
-- authorization.
--
-- Review status is just published/hidden (the two states a tenant/admin
-- can actually put a review in). "reported"/"unanswered" from the spec's
-- status list are not stored states -- they're derived (a pending
-- review_reports row / an absent review_replies row), which avoids a
-- second status field that could drift out of sync with the real report
-- records. "completed" order status from the spec doesn't exist in this
-- app's order_status enum -- only 'delivered' does.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  visitor_id text,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create index reviews_restaurant_id_idx on public.reviews (restaurant_id, created_at desc);

alter table public.reviews enable row level security;

create policy reviews_select_members on public.reviews
  for select using (public.has_restaurant_access(restaurant_id));

-- Tenant can hide a review (has_restaurant_access), but restoring a hidden
-- review requires super-admin -- enforced by the guard trigger below, not
-- by this policy (RLS controls which rows, not which values).
create policy reviews_update_members on public.reviews
  for update using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

create policy reviews_select_super_admin on public.reviews
  for select using (public.is_super_admin());

create policy reviews_update_super_admin on public.reviews
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- Only a super-admin may move a review back from hidden to published --
-- tenants can hide, never self-restore.
create or replace function public.guard_review_status_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.status = 'hidden' and new.status = 'published' and not public.is_super_admin() then
    raise exception 'Seul un administrateur peut restaurer un avis masqué';
  end if;
  return new;
end;
$function$;

create trigger reviews_guard_status_change
  before update of status on public.reviews
  for each row execute function public.guard_review_status_change();

-- Every super-admin status change on a review is logged, regardless of
-- whether it happened via direct RLS-gated update or an RPC -- satisfies
-- "les actions du super-admin doivent être enregistrées dans les logs"
-- uniformly, reusing the existing audit_logs/log_audit_event.
create or replace function public.audit_review_moderation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if public.is_super_admin() and old.status is distinct from new.status then
    perform public.log_audit_event(
      new.restaurant_id, auth.uid(), 'review', new.id, 'status_changed',
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$function$;

create trigger reviews_audit_moderation
  after update of status on public.reviews
  for each row execute function public.audit_review_moderation();

-- One reply per review (editable/deletable in place, per the spec's
-- allow_edit/allow_delete on a single reply -- not a reply thread).
create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.review_replies enable row level security;

create policy review_replies_select_members on public.review_replies
  for select using (public.has_restaurant_access(restaurant_id));

create policy review_replies_insert_members on public.review_replies
  for insert with check (public.has_restaurant_access(restaurant_id));

create policy review_replies_update_members on public.review_replies
  for update using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

create policy review_replies_delete_members on public.review_replies
  for delete using (public.has_restaurant_access(restaurant_id));

create trigger review_replies_set_updated_at
  before update on public.review_replies
  for each row execute function public.set_updated_at();

-- Notifies the customer's browser (via the existing client_notifications
-- feed built for Offers/order updates) that the tenant replied. Reuses
-- link_type='order' (already the only accepted value) and points at the
-- order so the click lands the customer straight on their order page,
-- where the reply is shown.
create or replace function public.notify_client_review_reply()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_visitor_id text;
  v_restaurant_id uuid;
  v_order_id uuid;
begin
  select r.visitor_id, r.restaurant_id, r.order_id
    into v_visitor_id, v_restaurant_id, v_order_id
    from public.reviews r
    where r.id = new.review_id;

  if v_visitor_id is null then
    return new;
  end if;

  insert into public.client_notifications (restaurant_id, visitor_id, type, title, body, link_type, link_id)
  values (v_restaurant_id, v_visitor_id, 'review_reply', 'Réponse à votre avis', 'Le vendeur a répondu à votre avis.', 'order', v_order_id);

  return new;
end;
$function$;

create trigger review_replies_notify_client
  after insert or update on public.review_replies
  for each row execute function public.notify_client_review_reply();

alter table public.client_notifications drop constraint client_notifications_type_check;
alter table public.client_notifications add constraint client_notifications_type_check
  check (type in ('order_confirmed', 'order_status_update', 'delivery_update', 'review_reply'));

-- Reported by either a customer (anonymous, visitor_id) or a tenant staff
-- member (auth.uid()) -- exactly one of reporter_visitor_id/reporter_user_id
-- is set, matching whichever identity the reporter actually has, rather
-- than fabricating a shared users.id for customers.
create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  reporter_type text not null check (reporter_type in ('customer', 'tenant')),
  reporter_visitor_id text,
  reporter_user_id uuid references auth.users(id),
  reason text not null check (reason in ('spam', 'harassment', 'offensive_content', 'false_review', 'inappropriate_content', 'other')),
  description text,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index review_reports_restaurant_id_idx on public.review_reports (restaurant_id, created_at desc);
create index review_reports_status_idx on public.review_reports (status);

alter table public.review_reports enable row level security;

create policy review_reports_select_members on public.review_reports
  for select using (public.has_restaurant_access(restaurant_id));

create policy review_reports_select_super_admin on public.review_reports
  for select using (public.is_super_admin());

create policy review_reports_update_super_admin on public.review_reports
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.set_review_report_resolved_at()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status in ('resolved', 'dismissed') and old.status not in ('resolved', 'dismissed') then
    new.resolved_at := now();
  end if;
  return new;
end;
$function$;

create trigger review_reports_set_resolved_at
  before update of status on public.review_reports
  for each row execute function public.set_review_report_resolved_at();

create or replace function public.audit_review_report_moderation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if public.is_super_admin() and old.status is distinct from new.status then
    perform public.log_audit_event(
      new.restaurant_id, auth.uid(), 'review_report', new.id, 'status_changed',
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$function$;

create trigger review_reports_audit_moderation
  after update of status on public.review_reports
  for each row execute function public.audit_review_report_moderation();

-- ---------------------------------------------------------------------------
-- Storefront-facing RPCs (anonymous, phone/visitor scoped -- same
-- ownership convention as get_customer_order/get_customer_orders)
-- ---------------------------------------------------------------------------

create or replace function public.submit_review(
  p_order_id uuid,
  p_customer_phone text,
  p_rating integer,
  p_comment text default null,
  p_photos jsonb default '[]'::jsonb,
  p_visitor_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
  v_review_id uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'La note doit être comprise entre 1 et 5';
  end if;

  select o.id, o.restaurant_id, o.customer_id, o.customer_name, o.status
    into v_order
    from public.orders o
    where o.id = p_order_id and o.customer_phone = p_customer_phone;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'Vous ne pouvez laisser un avis que pour une commande livrée';
  end if;
  if exists (select 1 from public.reviews r where r.order_id = p_order_id) then
    raise exception 'Un avis a déjà été laissé pour cette commande';
  end if;

  insert into public.reviews (restaurant_id, order_id, customer_id, visitor_id, customer_name, rating, comment, photos)
  values (
    v_order.restaurant_id, p_order_id, v_order.customer_id,
    nullif(btrim(coalesce(p_visitor_id, '')), ''), v_order.customer_name,
    p_rating, nullif(btrim(coalesce(p_comment, '')), ''), coalesce(p_photos, '[]'::jsonb)
  )
  returning id into v_review_id;

  perform public.create_notification(
    v_order.restaurant_id, null, 'new_review', 'Nouvel avis client',
    format('Note : %s/5', p_rating),
    jsonb_build_object('review_id', v_review_id, 'rating', p_rating)
  );

  return jsonb_build_object('review_id', v_review_id);
end;
$function$;

revoke all on function public.submit_review(uuid, text, integer, text, jsonb, text) from public;
grant execute on function public.submit_review(uuid, text, integer, text, jsonb, text) to anon, authenticated;

create or replace function public.update_review(
  p_review_id uuid,
  p_customer_phone text,
  p_rating integer,
  p_comment text default null,
  p_photos jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'La note doit être comprise entre 1 et 5';
  end if;

  update public.reviews r
    set rating = p_rating,
        comment = nullif(btrim(coalesce(p_comment, '')), ''),
        photos = coalesce(p_photos, '[]'::jsonb),
        updated_at = now()
    from public.orders o
    where r.id = p_review_id
      and o.id = r.order_id
      and o.customer_phone = p_customer_phone;

  if not found then
    raise exception 'Avis introuvable';
  end if;
end;
$function$;

revoke all on function public.update_review(uuid, text, integer, text, jsonb) from public;
grant execute on function public.update_review(uuid, text, integer, text, jsonb) to anon, authenticated;

create or replace function public.get_order_review(p_order_id uuid, p_customer_phone text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', r.id, 'rating', r.rating, 'comment', r.comment, 'photos', r.photos,
    'status', r.status, 'created_at', r.created_at,
    'reply', case when rr.id is null then null else jsonb_build_object('message', rr.message, 'created_at', rr.created_at) end
  )
  from public.reviews r
  join public.orders o on o.id = r.order_id
  left join public.review_replies rr on rr.review_id = r.id
  where r.order_id = p_order_id and o.customer_phone = p_customer_phone;
$function$;

revoke all on function public.get_order_review(uuid, text) from public;
grant execute on function public.get_order_review(uuid, text) to anon, authenticated;

create or replace function public.report_review(
  p_review_id uuid,
  p_reason text,
  p_description text default null,
  p_visitor_id text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
begin
  if p_reason not in ('spam', 'harassment', 'offensive_content', 'false_review', 'inappropriate_content', 'other') then
    raise exception 'Motif de signalement invalide';
  end if;

  select restaurant_id into v_restaurant_id from public.reviews where id = p_review_id;
  if v_restaurant_id is null then
    raise exception 'Avis introuvable';
  end if;

  insert into public.review_reports (review_id, restaurant_id, reporter_type, reporter_visitor_id, reporter_user_id, reason, description)
  values (
    p_review_id, v_restaurant_id,
    case when auth.uid() is not null then 'tenant' else 'customer' end,
    case when auth.uid() is null then nullif(btrim(coalesce(p_visitor_id, '')), '') else null end,
    auth.uid(),
    p_reason, nullif(btrim(coalesce(p_description, '')), '')
  );
end;
$function$;

revoke all on function public.report_review(uuid, text, text, text) from public;
grant execute on function public.report_review(uuid, text, text, text) to anon, authenticated;

create or replace function public.get_tenant_reviews(p_slug text, p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'customer_name', r.customer_name, 'rating', r.rating, 'comment', r.comment,
      'photos', r.photos, 'created_at', r.created_at,
      'reply', case when rr.id is null then null else jsonb_build_object('message', rr.message, 'created_at', rr.created_at) end
    ) order by r.created_at desc), '[]'::jsonb)
  from public.reviews r
  join public.restaurants rest on rest.id = r.restaurant_id and rest.slug = p_slug and rest.is_public = true and rest.status = 'active'
  left join public.review_replies rr on rr.review_id = r.id
  where r.status = 'published'
  limit greatest(p_limit, 1);
$function$;

revoke all on function public.get_tenant_reviews(text, integer) from public;
grant execute on function public.get_tenant_reviews(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tenant admin RPC (auth-resolved tenant, same pattern as
-- get_visitor_stats/get_offers_analytics)
-- ---------------------------------------------------------------------------

create or replace function public.get_reviews_stats()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select m.restaurant_id into v_restaurant_id
    from public.restaurant_memberships m
    where m.user_id = auth.uid() and m.status = 'active'
    order by m.created_at asc
    limit 1;

  if v_restaurant_id is null then
    raise exception 'No active restaurant membership';
  end if;

  select jsonb_build_object(
    'total_reviews', count(*),
    'average_rating', coalesce(round(avg(rating)::numeric, 2), 0),
    'five_star_reviews', count(*) filter (where rating = 5),
    'four_star_reviews', count(*) filter (where rating = 4),
    'three_star_reviews', count(*) filter (where rating = 3),
    'two_star_reviews', count(*) filter (where rating = 2),
    'one_star_reviews', count(*) filter (where rating = 1),
    'unanswered_reviews', count(*) filter (where not exists (select 1 from public.review_replies rr where rr.review_id = reviews.id)),
    'reported_reviews', count(*) filter (where exists (select 1 from public.review_reports rp where rp.review_id = reviews.id and rp.status in ('pending', 'under_review')))
  )
  into v_result
  from public.reviews
  where restaurant_id = v_restaurant_id;

  return v_result;
end;
$function$;

revoke all on function public.get_reviews_stats() from public;
grant execute on function public.get_reviews_stats() to authenticated;

alter publication supabase_realtime add table public.reviews;
alter publication supabase_realtime add table public.review_reports;
