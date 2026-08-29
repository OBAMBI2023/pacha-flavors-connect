-- WhatsApp Marketing module (v1 foundations): Vue d'ensemble, Audiences,
-- Campagnes, Créer une campagne. No WhatsApp Business API is integrated in
-- this project yet (only customer-initiated wa.me deep links exist) -- per
-- explicit product decision, v1 uses manual wa.me links with admin-confirmed
-- "sent" status, and never fabricates delivered/read/cost metrics that would
-- require a real API. Reuses `customers` (audiences), `promo_codes` +
-- `promo_code_usages` (offers + real order/revenue attribution),
-- `restaurants`, and the existing `is_super_admin()`-aware RLS helpers --
-- only the two genuinely missing pieces are added below.

alter table public.customers add column marketing_opt_out boolean not null default false;

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  created_by uuid references auth.users(id),
  objective text not null check (objective in ('reactivation', 'vip', 'new_customer', 'promotion', 'menu', 'loyalty')),
  name text not null,
  message_template text not null,
  promo_code_id uuid references public.promo_codes(id),
  audience_segment text,
  audience_filters jsonb not null default '{}'::jsonb,
  recipient_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'completed', 'cancelled', 'failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_campaigns_restaurant_id_idx on public.marketing_campaigns (restaurant_id);
create index marketing_campaigns_status_idx on public.marketing_campaigns (status);

create trigger marketing_campaigns_set_updated_at
  before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();

alter table public.marketing_campaigns enable row level security;

-- Super-admin-only tool for now -- matches the spec's own permissions list,
-- which names only super_admin actions for this module (no restaurant-role
-- entry). has_restaurant_access/has_restaurant_role already fold in
-- is_super_admin() everywhere else in this schema; here it's the sole check
-- since there is no restaurant-facing surface yet.
create policy marketing_campaigns_super_admin_all
  on public.marketing_campaigns for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  restaurant_id uuid not null references public.restaurants(id),
  phone_snapshot text not null,
  name_snapshot text not null,
  message_rendered text not null,
  wa_link text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'excluded')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create index marketing_campaign_recipients_campaign_id_idx on public.marketing_campaign_recipients (campaign_id);
create index marketing_campaign_recipients_customer_id_idx on public.marketing_campaign_recipients (customer_id);
create index marketing_campaign_recipients_restaurant_id_idx on public.marketing_campaign_recipients (restaurant_id);

alter table public.marketing_campaign_recipients enable row level security;

create policy marketing_campaign_recipients_super_admin_all
  on public.marketing_campaign_recipients for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
