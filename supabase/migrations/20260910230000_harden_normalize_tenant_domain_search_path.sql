-- Security hardening (audit finding L-01): public.normalize_tenant_domain()
-- (the BEFORE INSERT/UPDATE trigger on public.tenant_domains that
-- lowercases/strips the domain before the table's format/uniqueness
-- constraints see it) had no explicit search_path -- proconfig was null.
--
-- Verified on the remote project before this migration: the function is
-- actually SECURITY INVOKER (prosecdef = false), not SECURITY DEFINER as
-- the finding's general description suggests -- Supabase's own linter
-- (0011_function_search_path_mutable) flags any function lacking an
-- explicit search_path regardless of SECURITY DEFINER/INVOKER, since an
-- unqualified, mutable search_path can still resolve an unexpected object
-- if something upstream of this session altered it. This migration does
-- NOT change SECURITY INVOKER -> DEFINER (left exactly as-is) and does not
-- touch its business logic.
--
-- Every identifier the body actually resolves -- regexp_replace, lower,
-- trim -- lives in pg_catalog, which Postgres always searches implicitly
-- regardless of search_path (including search_path = ''); `new.domain` is
-- a plpgsql record field reference, not a schema lookup. The function
-- touches no public.* table or function, so search_path = '' requires NO
-- schema-qualification changes to the function body -- confirmed by
-- inspection, not by trial and error.
--
-- Only reference to this function in the codebase: the create + the
-- `tenant_domains_normalize` trigger, both in 20260904010000_tenant_domains.sql
-- (and the case-order bugfix in 20260904121532, already reflected in the
-- CREATE OR REPLACE below) -- no other trigger, RPC or frontend code path
-- touches it.
create or replace function public.normalize_tenant_domain()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.domain := regexp_replace(regexp_replace(lower(trim(new.domain)), '^https?://', ''), '/+$', '');
  return new;
end;
$$;
