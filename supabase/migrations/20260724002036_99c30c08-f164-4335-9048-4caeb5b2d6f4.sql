-- Roles
create type public.app_role as enum ('admin', 'customer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  created_at timestamp with time zone not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "Users can read their own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated, service_role;

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user_role() from anon, authenticated;
grant execute on function public.handle_new_user_role() to service_role;

create trigger on_auth_user_created_role
  after insert on auth.users
  for each row
  execute function public.handle_new_user_role();

-- Wishlist
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (user_id, product_id)
);

grant select, insert, delete on public.wishlist_items to authenticated;
grant all on public.wishlist_items to service_role;
alter table public.wishlist_items enable row level security;

create policy "Users can manage their own wishlist"
  on public.wishlist_items for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reviews
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  is_verified boolean not null default false,
  author_name text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (product_id, user_id)
);

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.reviews for select to anon, authenticated using (true);
create policy "Users can create their own reviews"
  on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own reviews"
  on public.reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own reviews"
  on public.reviews for delete to authenticated using (auth.uid() = user_id);

create trigger update_reviews_updated_at before update on public.reviews
  for each row execute function public.update_updated_at_column();

alter table public.products add column rating_avg numeric(3,2) not null default 0;
alter table public.products add column rating_count integer not null default 0;

create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.product_id, old.product_id);
  update public.products p set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = pid), 0),
    rating_count = (select count(*) from public.reviews where product_id = pid)
  where p.id = pid;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.refresh_product_rating() from anon, authenticated;
grant execute on function public.refresh_product_rating() to service_role;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- Coupons
create type public.discount_type as enum ('percent', 'fixed');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value integer not null,
  min_order_inr integer not null default 0,
  max_discount_inr integer,
  active boolean not null default true,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  usage_limit integer,
  used_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant all on public.coupons to service_role;
alter table public.coupons enable row level security;

create trigger update_coupons_updated_at before update on public.coupons
  for each row execute function public.update_updated_at_column();

alter table public.orders add column subtotal_inr integer;
alter table public.orders add column discount_inr integer not null default 0;
alter table public.orders add column coupon_code text;

-- Stock decrement
create or replace function public.decrement_stock_on_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.variant_id is not null then
    update public.product_variants
      set stock = greatest(0, stock - new.quantity)
      where id = new.variant_id;
  end if;
  update public.products
    set stock = greatest(0, stock - new.quantity)
    where id = new.product_id;
  return new;
end;
$$;

revoke execute on function public.decrement_stock_on_order_item() from anon, authenticated;
grant execute on function public.decrement_stock_on_order_item() to service_role;

create trigger order_items_decrement_stock
  after insert on public.order_items
  for each row execute function public.decrement_stock_on_order_item();

-- Admin management policies
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant update on public.orders to authenticated;

create policy "Admins can manage products"
  on public.products for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage product variants"
  on public.product_variants for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage categories"
  on public.categories for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can view all orders"
  on public.orders for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update orders"
  on public.orders for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can view all order items"
  on public.order_items for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete reviews"
  on public.reviews for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Realtime
alter publication supabase_realtime add table public.wishlist_items;
alter publication supabase_realtime add table public.reviews;

-- Seed coupons
insert into public.coupons (code, description, discount_type, discount_value, min_order_inr, max_discount_inr, active) values
  ('WELCOME10', '10% off your first order (min ₹999)', 'percent', 10, 999, 500, true),
  ('LUXE15', '15% off orders above ₹2499', 'percent', 15, 2499, 1000, true),
  ('FLAT200', '₹200 off orders above ₹1499', 'fixed', 200, 1499, null, true);
