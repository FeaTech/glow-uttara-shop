create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name',
                         new.raw_user_meta_data->>'name', '')), '')
  )
  on conflict (id) do update
    set full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

update public.profiles p
set full_name = nullif(trim(coalesce(u.raw_user_meta_data->>'full_name',
                                     u.raw_user_meta_data->>'name',
                                     split_part(u.email, '@', 1), '')), '')
from auth.users u
where u.id = p.id and (p.full_name is null or p.full_name = '');

create or replace function public.my_referral_history()
returns table(id uuid, order_id uuid, referred_customer text, referral_level smallint, order_date timestamp with time zone, eligible_order_amount integer, commission_percentage numeric, commission_amount integer, adjustment_amount integer, status referral_commission_status)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    rc.id,
    rc.order_id,
    coalesce(nullif(trim(coalesce(p.full_name, '')), ''),
             'Customer ' || upper(right(rc.purchasing_user_id::text, 4))),
    rc.referral_level,
    coalesce(o.created_at, rc.created_at),
    rc.eligible_order_amount,
    rc.commission_percentage,
    rc.commission_amount,
    rc.adjustment_amount,
    rc.status
  from public.referral_commissions rc
  left join public.orders o on o.id = rc.order_id
  left join public.profiles p on p.id = rc.purchasing_user_id
  where rc.beneficiary_user_id = auth.uid()
  order by rc.created_at desc;
$$;