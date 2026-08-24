-- Trigger functions are never meant to be called directly via PostgREST RPC
-- (Postgres itself rejects a direct call outside trigger context, and
-- revoking EXECUTE does not stop the trigger from firing -- trigger
-- invocation bypasses role-based EXECUTE checks). Locking these down anyway
-- for advisor hygiene / defense in depth.
revoke all on function public.validate_promo_code_row() from public, anon, authenticated;
revoke all on function public.validate_promo_code_target() from public, anon, authenticated;
