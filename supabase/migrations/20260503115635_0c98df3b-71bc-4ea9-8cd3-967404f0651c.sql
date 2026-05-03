-- Restrict client-side read access to Plaid access tokens
REVOKE SELECT (plaid_access_token) ON public.bank_items FROM anon, authenticated;

-- Restrict execution of SECURITY DEFINER helper functions; they are only called by triggers/internally
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;