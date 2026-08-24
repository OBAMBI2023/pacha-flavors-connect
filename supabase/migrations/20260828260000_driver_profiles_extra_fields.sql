-- Personal-info fields for the new admin driver-management module. All
-- nullable/additive -- full_name stays the single stored name field
-- (already used throughout dispatch/notifications); the add-driver form
-- collects Nom/Prénom separately and concatenates into full_name.
alter table public.driver_profiles
  add column email text,
  add column phone_secondary text,
  add column address text,
  add column photo_path text,
  add column date_of_birth date,
  add column hired_at date,
  add column internal_note text;
