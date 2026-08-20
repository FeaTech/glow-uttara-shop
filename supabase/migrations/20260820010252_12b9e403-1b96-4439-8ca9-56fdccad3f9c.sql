-- Lock down the new coupon tracking tables: only service_role (used by
-- security-definer RPC functions) can read/write them. RLS is already enabled;
-- these policies satisfy the linter and keep the tables closed to app users.

create policy "Service role manages coupon customer usage"
  on public.coupon_customer_usage
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role manages coupon redemptions"
  on public.coupon_redemptions
  for all
  to service_role
  using (true)
  with check (true);

-- Ensure the new security-definer functions are not directly callable by
-- anonymous or authenticated users. They are intended to be invoked only by
-- service_role inside server functions.
revoke execute on function public.reserve_coupon_usage(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.release_coupon_usage(uuid) from public, anon, authenticated;
revoke execute on function public.release_coupon_on_order_failure() from public, anon, authenticated;

grant execute on function public.reserve_coupon_usage(text, uuid, uuid) to service_role;
grant execute on function public.release_coupon_usage(uuid) to service_role;
grant execute on function public.release_coupon_on_order_failure() to service_role;