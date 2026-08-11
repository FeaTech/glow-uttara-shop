-- Variant inventory is independent from the parent product's stock. A sale of
-- a variant must only reserve that selected variant; a sale without a variant
-- reserves the product itself.
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
  else
    -- Once a product has variants, only a variant can be sold. This prevents a
    -- client from bypassing the variant inventory count with a product-only line.
    if exists (
      select 1
      from public.product_variants
      where product_id = new.product_id
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

-- A BEFORE trigger prevents the order line from being created when the atomic
-- stock update cannot reserve the requested quantity.
drop trigger if exists order_items_decrement_stock on public.order_items;
create trigger order_items_decrement_stock
  before insert on public.order_items
  for each row execute function public.decrement_stock_on_order_item();

-- Restore inventory through the database so customer and admin cancellations
-- use the same source of truth as the original decrement.
create or replace function public.restore_stock_on_order_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for item in
      select product_id, variant_id, quantity
      from public.order_items
      where order_id = new.id
    loop
      if item.variant_id is not null then
        update public.product_variants
          set stock = stock + item.quantity
          where id = item.variant_id;
      else
        update public.products
          set stock = stock + item.quantity
          where id = item.product_id;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_restore_stock_on_cancel on public.orders;
create trigger orders_restore_stock_on_cancel
  after update of status on public.orders
  for each row execute function public.restore_stock_on_order_cancel();

revoke execute on function public.decrement_stock_on_order_item() from public, anon, authenticated;
revoke execute on function public.restore_stock_on_order_cancel() from public, anon, authenticated;
grant execute on function public.decrement_stock_on_order_item() to service_role;
grant execute on function public.restore_stock_on_order_cancel() to service_role;

-- Keep the admin inventory list current as sales update either stock table.
alter table public.products replica identity full;
alter table public.product_variants replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['products', 'product_variants'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
