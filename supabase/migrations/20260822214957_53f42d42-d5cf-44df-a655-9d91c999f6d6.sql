-- Coupons: explicit admin-only access (table is otherwise only read by trusted server code)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

DROP POLICY IF EXISTS "Admins can view coupons" ON public.coupons;
CREATE POLICY "Admins can view coupons" ON public.coupons
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create coupons" ON public.coupons;
CREATE POLICY "Admins can create coupons" ON public.coupons
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update coupons" ON public.coupons;
CREATE POLICY "Admins can update coupons" ON public.coupons
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete coupons" ON public.coupons;
CREATE POLICY "Admins can delete coupons" ON public.coupons
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Lock down privileged security-definer functions: server-only (service role).
REVOKE ALL ON FUNCTION public.restore_order_stock(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.release_coupon_usage(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.reserve_coupon_usage(text, uuid, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.increment_coupon_usage(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_coupon_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_coupon_usage(text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(text) TO service_role;

-- Referral approval: admin-only, enforced inside the function too.
CREATE OR REPLACE FUNCTION public.approve_due_referral_commissions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare days integer; n integer;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Forbidden: admin access required';
  end if;
  select approval_waiting_days into days from public.referral_settings where id;
  update public.referral_commissions
    set status = 'approved', approved_at = now()
  where status = 'pending'
    and created_at < now() - make_interval(days => coalesce(days, 7));
  get diagnostics n = row_count;
  return n;
end;
$function$;

REVOKE ALL ON FUNCTION public.approve_due_referral_commissions() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_due_referral_commissions() TO authenticated, service_role;

-- Anonymous visitors never need these signed-in helpers.
REVOKE ALL ON FUNCTION public.my_referral_counts() FROM anon, public;
REVOKE ALL ON FUNCTION public.my_referral_history() FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_referral_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_referral_history() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated, service_role;