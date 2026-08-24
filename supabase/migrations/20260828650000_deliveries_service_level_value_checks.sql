-- Non-negativity guards on the Phase 2B value/pricing columns -- additive,
-- all columns already nullable so this only constrains non-null values.
alter table public.deliveries
  add constraint deliveries_declared_value_nonneg check (declared_value is null or declared_value >= 0),
  add constraint deliveries_cod_amount_nonneg check (cod_amount is null or cod_amount >= 0),
  add constraint deliveries_delivery_fee_nonneg check (delivery_fee is null or delivery_fee >= 0),
  add constraint deliveries_delivery_distance_km_nonneg check (delivery_distance_km is null or delivery_distance_km >= 0);
