-- Admins need to read profiles for referral admin screens
create policy "Admins can view all profiles"
on public.profiles for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Admins write audit rows
create policy "Admins can insert commission audit"
on public.referral_commission_audit for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));

-- Own referral counts (direct + indirect) without exposing other profiles
create or replace function public.my_referral_counts()
returns table(direct_count integer, indirect_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.profiles where referred_by_user_id = auth.uid()),
    (select count(*)::int from public.profiles p2
      where p2.referred_by_user_id in (
        select id from public.profiles where referred_by_user_id = auth.uid()
      ));
$$;

grant execute on function public.my_referral_counts() to authenticated;
revoke execute on function public.my_referral_counts() from anon;

-- Own referral history with only the purchaser's first name
create or replace function public.my_referral_history()
returns table(
  id uuid,
  order_id uuid,
  referred_customer text,
  referral_level smallint,
  order_date timestamptz,
  eligible_order_amount integer,
  commission_percentage numeric,
  commission_amount integer,
  adjustment_amount integer,
  status referral_commission_status
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rc.id,
    rc.order_id,
    coalesce(nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''),
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

grant execute on function public.my_referral_history() to authenticated;
revoke execute on function public.my_referral_history() from anon;