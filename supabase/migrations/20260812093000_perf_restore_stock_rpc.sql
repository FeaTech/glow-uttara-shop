-- ============================================================================
-- PERFORMANCE FIX #6 — cancelOrder was an N+1 (2-4 queries per line item)
--
-- The app restores stock on cancellation (the DB-side restore trigger was
-- intentionally dropped in 20260811230519 to avoid double-restoring). That
-- app-side loop issued a SELECT + UPDATE per variant AND per product, serially,
-- so a 5-line order cost up to 20 sequential round trips.
--
-- This does the identical restore in ONE atomic statement. It also removes a
-- read-modify-write race: the old code read `stock` then wrote `stock + qty`,
-- which could lose concurrent updates.
--
-- Semantics preserved exactly:
--   • variant stock += quantity  (when the line has a variant)
--   • product stock += quantity  (always — products.stock is the legacy mirror)
-- Quantities are summed per id first, so repeated products in one order are
-- restored correctly (a plain UPDATE..FROM would apply only one matching row).
-- ============================================================================

create or replace function public.restore_order_stock(_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with variant_totals as (
    select variant_id, sum(quantity)::integer as qty
    from public.order_items
    where order_id = _order_id and variant_id is not null
    group by variant_id
  ),
  product_totals as (
    select product_id, sum(quantity)::integer as qty
    from public.order_items
    where order_id = _order_id
    group by product_id
  ),
  restore_variants as (
    update public.product_variants pv
      set stock = pv.stock + vt.qty
    from variant_totals vt
    where pv.id = vt.variant_id
    returning 1
  )
  update public.products p
    set stock = p.stock + pt.qty
  from product_totals pt
  where p.id = pt.product_id;
$$;

revoke execute on function public.restore_order_stock(uuid) from anon, authenticated;
grant execute on function public.restore_order_stock(uuid) to service_role;
