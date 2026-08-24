-- Server-side backstop for "at least one fulfillment mode must stay active"
-- -- the admin UI already enforces this, but never trust a frontend-only
-- check. delivery_enabled/pickup_enabled already exist and already default
-- true; create_order already validates fulfillment_type against them.
alter table public.restaurant_settings
  add constraint restaurant_settings_at_least_one_fulfillment_mode
  check (delivery_enabled or pickup_enabled);
