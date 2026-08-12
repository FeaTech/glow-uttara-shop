-- ============================================================================
-- PERFORMANCE FIX #6b — atomic coupon usage increment
--
-- createOrder previously did SELECT used_count -> UPDATE used_count + 1 as two
-- serial round trips inside the checkout request. Besides the extra latency on
-- the most latency-sensitive action in the app, the read-modify-write could
-- lose a concurrent redemption and let a usage_limit be exceeded.
-- ============================================================================

create or replace function public.increment_coupon_usage(_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
    set used_count = used_count + 1
  where code = upper(trim(_code));
$$;

revoke execute on function public.increment_coupon_usage(text) from anon, authenticated;
grant execute on function public.increment_coupon_usage(text) to service_role;
