-- Keep a single cart row for both base products and variants, and make cart
-- quantity changes atomic so rapid clicks cannot create duplicate lines.
with grouped as (
  select cart_id, product_id, variant_id, min(id::text)::uuid as keep_id, sum(quantity) as total_quantity
  from public.cart_items
  group by cart_id, product_id, variant_id
  having count(*) > 1
)
update public.cart_items ci set quantity = grouped.total_quantity
from grouped where ci.id = grouped.keep_id;

delete from public.cart_items ci
using public.cart_items keep
where ci.id > keep.id
  and ci.cart_id = keep.cart_id
  and ci.product_id = keep.product_id
  and ci.variant_id is not distinct from keep.variant_id;

alter table public.cart_items drop constraint if exists cart_items_cart_id_product_id_variant_id_key;
create unique index if not exists cart_items_unique_product_variant
  on public.cart_items (cart_id, product_id, variant_id) nulls not distinct;

create or replace function public.add_cart_item(p_product_id uuid, p_variant_id uuid, p_quantity integer)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_cart_id uuid; v_available integer; v_item_id uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_quantity < 1 or p_quantity > 99 then raise exception 'Invalid quantity'; end if;
  if p_variant_id is not null then
    select stock into v_available from public.product_variants where id=p_variant_id and product_id=p_product_id;
    if not found then raise exception 'That variant is no longer available'; end if;
  else
    if exists (select 1 from public.product_variants where product_id=p_product_id) then raise exception 'Please select a product variant'; end if;
    select stock into v_available from public.products where id=p_product_id;
    if not found then raise exception 'Product not found'; end if;
  end if;
  if p_quantity > v_available then raise exception 'Only % left in stock', v_available; end if;
  insert into public.cart(user_id,status) values(auth.uid(),'active')
  on conflict(user_id,status) do update set updated_at=public.cart.updated_at
  returning id into v_cart_id;
  insert into public.cart_items(cart_id,product_id,variant_id,quantity)
  values(v_cart_id,p_product_id,p_variant_id,p_quantity)
  on conflict(cart_id,product_id,variant_id) do update set quantity=public.cart_items.quantity + excluded.quantity
  where public.cart_items.quantity + excluded.quantity <= v_available
  returning id into v_item_id;
  if v_item_id is null then raise exception 'Only % left in stock', v_available; end if;
  return v_item_id;
end; $$;

create or replace function public.set_cart_item_quantity(p_item_id uuid, p_quantity integer)
returns void language plpgsql security invoker set search_path = public as $$
declare v_available integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_quantity < 0 or p_quantity > 99 then raise exception 'Invalid quantity'; end if;
  if p_quantity = 0 then
    delete from public.cart_items ci using public.cart c where ci.id=p_item_id and ci.cart_id=c.id and c.user_id=auth.uid(); return;
  end if;
  select coalesce(v.stock,p.stock) into v_available from public.cart_items ci join public.cart c on c.id=ci.cart_id join public.products p on p.id=ci.product_id left join public.product_variants v on v.id=ci.variant_id where ci.id=p_item_id and c.user_id=auth.uid();
  if not found then raise exception 'Cart item not found'; end if;
  if p_quantity > v_available then raise exception 'Only % left in stock', v_available; end if;
  update public.cart_items ci set quantity=p_quantity from public.cart c where ci.id=p_item_id and ci.cart_id=c.id and c.user_id=auth.uid();
end; $$;

revoke all on function public.add_cart_item(uuid,uuid,integer) from public, anon;
revoke all on function public.set_cart_item_quantity(uuid,integer) from public, anon;
grant execute on function public.add_cart_item(uuid,uuid,integer) to authenticated;
grant execute on function public.set_cart_item_quantity(uuid,integer) to authenticated;

alter table public.orders add column if not exists idempotency_key uuid;
create unique index if not exists orders_user_id_idempotency_key_unique on public.orders(user_id,idempotency_key) where idempotency_key is not null;
