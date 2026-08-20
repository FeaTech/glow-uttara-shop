-- Per-customer coupon limits with calendar-month renewal.
-- Usage is lazily renewed on the first redemption in each Asia/Kolkata month;
-- no scheduled job is required.

alter table public.coupons
  add column if not exists customer_monthly_limit integer,
  add column if not exists customer_lifetime_limit integer,
  add column if not exists eligibility text not null default 'everyone';

alter table public.coupons
  add constraint coupons_customer_monthly_limit_check
    check (customer_monthly_limit is null or customer_monthly_limit > 0),
  add constraint coupons_customer_lifetime_limit_check
    check (customer_lifetime_limit is null or customer_lifetime_limit > 0),
  add constraint coupons_eligibility_check
    check (eligibility in ('everyone', 'new_customers', 'selected_customers'));

create table public.coupon_customer_usage (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  usage_month date not null,
  monthly_used_count integer not null default 0,
  lifetime_used_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (coupon_id, customer_id),
  check (monthly_used_count >= 0),
  check (lifetime_used_count >= 0)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  usage_month date not null,
  status text not null default 'reserved' check (status in ('reserved', 'released')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

grant all on public.coupon_customer_usage to service_role;
grant all on public.coupon_redemptions to service_role;
alter table public.coupon_customer_usage enable row level security;
alter table public.coupon_redemptions enable row level security;

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
  if c.eligibility = 'new_customers' and exists (
    select 1 from public.orders where user_id = _customer_id and status <> 'cancelled'
  ) then raise exception 'This coupon is only available on your first order'; end if;

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
  if c.customer_monthly_limit is not null and usage_row.monthly_used_count >= c.customer_monthly_limit then raise exception 'You have reached this coupon''s monthly limit'; end if;
  if c.customer_lifetime_limit is not null and usage_row.lifetime_used_count >= c.customer_lifetime_limit then raise exception 'You have reached this coupon''s lifetime limit'; end if;

  update public.coupon_customer_usage
    set monthly_used_count = monthly_used_count + 1, lifetime_used_count = lifetime_used_count + 1, updated_at = now()
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
    set monthly_used_count = greatest(0, monthly_used_count - 1), lifetime_used_count = greatest(0, lifetime_used_count - 1), updated_at = now()
    where coupon_id = r.coupon_id and customer_id = r.customer_id;
  update public.coupons set used_count = greatest(0, used_count - 1) where id = r.coupon_id;
  update public.coupon_redemptions set status = 'released', released_at = now() where id = r.id;
end;
$$;

revoke execute on function public.reserve_coupon_usage(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.release_coupon_usage(uuid) from public, anon, authenticated;
grant execute on function public.reserve_coupon_usage(text, uuid, uuid) to service_role;
grant execute on function public.release_coupon_usage(uuid) to service_role;

create or replace function public.release_coupon_on_order_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status = 'cancelled' and old.status is distinct from 'cancelled')
     or (new.payment_status in ('failed', 'refunded') and old.payment_status is distinct from new.payment_status) then
    perform public.release_coupon_usage(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_release_coupon_on_failure on public.orders;
create trigger orders_release_coupon_on_failure
  after update of status, payment_status on public.orders
  for each row execute function public.release_coupon_on_order_failure();

revoke execute on function public.release_coupon_on_order_failure() from public, anon, authenticated;

-- Preserve the existing WELCOME10 intent: only customers with no prior
-- non-cancelled order may use it, and only once in their lifetime.
update public.coupons
  set eligibility = 'new_customers', customer_lifetime_limit = 1
  where code = 'WELCOME10';