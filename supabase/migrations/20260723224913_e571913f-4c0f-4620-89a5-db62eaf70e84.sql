revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.update_updated_at_column() from anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.update_updated_at_column() to service_role;

-- Re-run linter should now pass for these functions
