-- ============================================================================
-- PERFORMANCE FIX #5 — admin dashboard was transferring the whole store
--
-- adminStats previously ran `select * from orders` (unbounded) plus every
-- product with every variant, then aggregated in JavaScript — just to render
-- 6 counters, a 7-day chart and 8 low-stock rows. It also re-ran on every
-- realtime product/variant event.
--
-- This computes the same numbers as aggregates inside Postgres and returns a
-- single small JSON payload.
-- ============================================================================

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_role((select auth.uid()), 'admin') then
    raise exception 'Forbidden: admin access required';
  end if;

  select jsonb_build_object(
    'revenue',       coalesce((select sum(total_inr) from public.orders where status <> 'cancelled'), 0),
    'orderCount',    (select count(*) from public.orders),
    'pendingCount',  (select count(*) from public.orders where status = 'pending'),
    'productCount',  (select count(*) from public.products),
    'customerCount', (select count(*) from public.user_roles where role = 'customer'),

    'revenueByDay', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('date', to_char(d.day, 'Dy'), 'revenue', d.revenue, 'orders', d.orders)
          order by d.day
        ),
        '[]'::jsonb
      )
      from (
        select
          gs::date as day,
          coalesce(sum(o.total_inr) filter (where o.status <> 'cancelled'), 0)::bigint as revenue,
          (count(o.id) filter (where o.status <> 'cancelled'))::int as orders
        from generate_series(
               (current_date - interval '6 days')::timestamptz,
               current_date::timestamptz,
               interval '1 day'
             ) gs
        left join public.orders o
          on o.created_at >= gs and o.created_at < gs + interval '1 day'
        group by gs
      ) d
    ),

    'lowStock', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.stock), '[]'::jsonb)
      from (
        select v.id, (p.name || ' — ' || v.variant_name) as name, p.slug, v.stock
        from public.product_variants v
        join public.products p on p.id = v.product_id
        where v.stock <= 10
        union all
        select p.id, p.name, p.slug, p.stock
        from public.products p
        where p.stock <= 10
          and not exists (select 1 from public.product_variants v where v.product_id = p.id)
        order by stock asc
        limit 8
      ) x
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.admin_dashboard_stats() from anon;
grant execute on function public.admin_dashboard_stats() to authenticated, service_role;
