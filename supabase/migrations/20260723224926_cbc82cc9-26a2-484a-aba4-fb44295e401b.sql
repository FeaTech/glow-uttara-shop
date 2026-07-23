revoke execute on function public.handle_new_user() from public;
revoke execute on function public.update_updated_at_column() from public;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.update_updated_at_column() to service_role;
