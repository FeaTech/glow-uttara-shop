-- Lifetime customer limits are intentionally removed. Coupons now support
-- only the overall campaign limit and the per-customer calendar-month limit.

alter table public.coupons
  drop constraint if exists coupons_customer_lifetime_limit_check,
  drop column if exists customer_lifetime_limit;

alter table public.coupon_customer_usage
  drop constraint if exists coupon_customer_usage_lifetime_used_count_check,
  drop column if exists lifetime_used_count;

create or replace function public.reserve_coupon_usage(_code text, _customer_id uuid, _order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.coupons%rowtype;
  usage_row public.coupon_customer_usage%rowtype;
  month_start date := date_trunc('month', timezone('Asia/Kolkata', now()))::date;
begin
  select * into c from public.coupons where code = upper(trim(_code)) for update;
  if not found then raise exception 'Invalid coupon code'; end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then raise exception 'This coupon has reached its usage limit'; end if;
  if c.starts_at is not null and c.starts_at > now() then raise exception 'This coupon is not active yet'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'This coupon has expired'; end if;
  if c.eligibility = 'selected_customers' then raise exception 'This coupon is not available to your account'; end if;
  if c.eligibility = 'new_customers' and exists (select 1 from public.orders where user_id = _customer_id and status <> 'cancelled') then
    raise exception 'This coupon is only available on your first order';
  end if;

  insert into public.coupon_customer_usage (coupon_id, customer_id, usage_month)
  values (c.id, _customer_id, month_start)
  on conflict (coupon_id, customer_id) do nothing;
  select * into usage_row from public.coupon_customer_usage
    where coupon_id = c.id and customer_id = _customer_id for update;
  if usage_row.usage_month <> month_start then
    update public.coupon_customer_usage
      set usage_month = month_start, monthly_used_count = 0, updated_at = now()
      where coupon_id = c.id and customer_id = _customer_id;
    usage_row.monthly_used_count := 0;
  end if;
  if c.customer_monthly_limit is not null and usage_row.monthly_used_count >= c.customer_monthly_limit then
    raise exception 'You have reached this coupon''s monthly limit';
  end if;
  update public.coupon_customer_usage
    set monthly_used_count = monthly_used_count + 1, updated_at = now()
    where coupon_id = c.id and customer_id = _customer_id;
  update public.coupons set used_count = used_count + 1 where id = c.id;
  insert into public.coupon_redemptions (coupon_id, customer_id, order_id, usage_month)
    values (c.id, _customer_id, _order_id, month_start);
end;
$$;

create or replace function public.release_coupon_usage(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.coupon_redemptions%rowtype;
begin
  select * into r from public.coupon_redemptions where order_id = _order_id for update;
  if not found or r.status = 'released' then return; end if;
  update public.coupon_customer_usage
    set monthly_used_count = greatest(0, monthly_used_count - 1), updated_at = now()
    where coupon_id = r.coupon_id and customer_id = r.customer_id;
  update public.coupons set used_count = greatest(0, used_count - 1) where id = r.coupon_id;
  update public.coupon_redemptions set status = 'released', released_at = now() where id = r.id;
end;
$$;

revoke execute on function public.reserve_coupon_usage(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.release_coupon_usage(uuid) from public, anon, authenticated;
grant execute on function public.reserve_coupon_usage(text, uuid, uuid) to service_role;
grant execute on function public.release_coupon_usage(uuid) to service_role;
