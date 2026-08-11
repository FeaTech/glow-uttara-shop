-- Keep the product stock column as a legacy mirror of total variant inventory.
-- This maintains compatibility with the already-deployed cancellation code
-- while the admin UI uses per-variant stock as the source of truth.
create or replace function public.decrement_stock_on_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quantity <= 0 then
    raise exception 'Order item quantity must be positive';
  end if;

  if new.variant_id is not null then
    update public.product_variants
      set stock = stock - new.quantity
      where id = new.variant_id
        and product_id = new.product_id
        and stock >= new.quantity;

    if not found then
      raise exception 'The selected variant is out of stock';
    end if;

    update public.products
      set stock = greatest(0, stock - new.quantity)
      where id = new.product_id;
  else
    if exists (
      select 1 from public.product_variants where product_id = new.product_id
    ) then
      raise exception 'A product variant must be selected';
    end if;

    update public.products
      set stock = stock - new.quantity
      where id = new.product_id
        and stock >= new.quantity;

    if not found then
      raise exception 'This product is out of stock';
    end if;
  end if;

  return new;
end;
$$;

-- The currently deployed app already restores stock on cancellation. Remove
-- the database-side restoration trigger to avoid double-restoring a variant.
drop trigger if exists orders_restore_stock_on_cancel on public.orders;
drop function if exists public.restore_stock_on_order_cancel();

-- Bring the legacy product stock mirror in sync for existing variant products.
update public.products product
set stock = variants.total_stock
from (
  select product_id, coalesce(sum(stock), 0)::integer as total_stock
  from public.product_variants
  group by product_id
) variants
where product.id = variants.product_id;
