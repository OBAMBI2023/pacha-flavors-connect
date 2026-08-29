-- sync_product_availability_from_inventory kept its default Postgres PUBLIC
-- execute grant (proacl showed "=X/postgres", not a named anon/authenticated
-- entry), so revoking from the named roles alone (previous migration) was a
-- no-op. Revoke from PUBLIC directly; trigger firing does not require EXECUTE
-- on the function.
revoke execute on function public.sync_product_availability_from_inventory() from public;
