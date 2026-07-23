create type public.order_status as enum ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users can manage their own profile"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
alter table public.addresses enable row level security;
create policy "Users can manage their own addresses"
  on public.addresses for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant select on public.categories to anon;
grant select on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "Categories are publicly readable"
  on public.categories for select
  to anon, authenticated
  using (true);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  short_description text,
  price_inr integer not null,
  compare_price_inr integer,
  category_id uuid references public.categories(id) on delete set null,
  images jsonb not null default '[]'::jsonb,
  stock integer not null default 0,
  is_featured boolean not null default false,
  attributes jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant select on public.products to anon;
grant select on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Products are publicly readable"
  on public.products for select
  to anon, authenticated
  using (true);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_name text not null,
  sku text,
  price_inr integer,
  stock integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant select on public.product_variants to anon;
grant select on public.product_variants to authenticated;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;
create policy "Product variants are publicly readable"
  on public.product_variants for select
  to anon, authenticated
  using (true);

create table public.cart (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, status)
);

grant select, insert, update, delete on public.cart to authenticated;
grant all on public.cart to service_role;
alter table public.cart enable row level security;
create policy "Users can manage their own cart"
  on public.cart for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.cart(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (cart_id, product_id, variant_id)
);

grant select, insert, update, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;
alter table public.cart_items enable row level security;
create policy "Users can manage items in their own cart"
  on public.cart_items for all
  to authenticated
  using (
    exists (
      select 1 from public.cart c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cart c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.order_status not null default 'pending',
  total_inr integer not null,
  shipping_address jsonb not null,
  payment_status public.payment_status not null default 'pending',
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant select, insert on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Users can view their own orders"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);
create policy "Users can place their own orders"
  on public.orders for insert
  to authenticated
  with check (auth.uid() = user_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null,
  price_inr integer not null,
  name text not null,
  created_at timestamp with time zone not null default now()
);

grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "Users can view their own order items"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Updated-at helper
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();
create trigger update_addresses_updated_at before update on public.addresses
  for each row execute function public.update_updated_at_column();
create trigger update_categories_updated_at before update on public.categories
  for each row execute function public.update_updated_at_column();
create trigger update_products_updated_at before update on public.products
  for each row execute function public.update_updated_at_column();
create trigger update_product_variants_updated_at before update on public.product_variants
  for each row execute function public.update_updated_at_column();
create trigger update_cart_updated_at before update on public.cart
  for each row execute function public.update_updated_at_column();
create trigger update_cart_items_updated_at before update on public.cart_items
  for each row execute function public.update_updated_at_column();
create trigger update_orders_updated_at before update on public.orders
  for each row execute function public.update_updated_at_column();

-- Enable realtime for cart and orders
alter publication supabase_realtime add table public.cart;
alter publication supabase_realtime add table public.cart_items;
alter publication supabase_realtime add table public.orders;

-- Seed categories
insert into public.categories (slug, name, description, sort_order) values
  ('makeup', 'Makeup', 'Foundations, lipsticks, eyeshadows, and more for every look.', 1),
  ('skincare', 'Skincare', 'Serums, moisturizers, cleansers, and sunscreens for radiant skin.', 2),
  ('haircare', 'Haircare', 'Shampoos, conditioners, oils, and treatments for healthy hair.', 3),
  ('fragrances', 'Fragrances', 'Perfumes, body mists, and colognes for men and women.', 4),
  ('beauty-accessories', 'Beauty Accessories', 'Brushes, sponges, mirrors, and tools to perfect your routine.', 5);

-- Seed products (sample data for Indian market)
with cats as (
  select id, slug from public.categories
)
insert into public.products (slug, name, short_description, description, price_inr, compare_price_inr, category_id, images, stock, is_featured, attributes, tags)
select
  p.slug, p.name, p.short_description, p.description, p.price_inr, p.compare_price_inr, c.id, p.images::jsonb, p.stock, p.is_featured, p.attributes::jsonb, p.tags::text[]
from cats c
join (values
  ('makeup', 'lux-matte-foundation', 'Lux Matte Foundation', '24-hour matte foundation with buildable coverage', 'A lightweight, buildable matte foundation that stays flawless for up to 24 hours. Available in a wide shade range for Indian skin tones.', 899, 1199, '["https://images.unsplash.com/photo-1596462502278-27bfdd403348?w=800&q=80"]', 120, true, '{"shade":"Honey Beige","finish":"Matte","coverage":"Medium to Full","skin_type":"All"}', ARRAY['foundation','makeup','face']),
  ('makeup', 'velvet-liquid-lipstick', 'Velvet Liquid Lipstick', 'Long-stay liquid lipstick with a creamy matte finish', 'Infused with vitamin E, this liquid lipstick delivers intense colour that lasts all day without drying your lips.', 649, 899, '["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&q=80"]', 200, true, '{"shade":"Brick Red","finish":"Cream Matte","benefit":"Long-wearing"}', ARRAY['lipstick','makeup','lips']),
  ('makeup', 'rose-gold-eyeshadow-palette', 'Rose Gold Eyeshadow Palette', '12 warm-toned shimmer and matte shades', 'A versatile palette of 12 buttery shades ranging from everyday nudes to glamorous rose-gold shimmers.', 1299, 1699, '["https://images.unsplash.com/photo-1596462502278-27bfdd403348?w=800&q=80"]', 85, true, '{"shades":"12","finish":"Shimmer + Matte","benefit":"Blendable"}', ARRAY['eyeshadow','makeup','eyes']),
  ('makeup', 'waterproof-kohl-pencil', 'Waterproof Kohl Pencil', 'Smudge-proof kajal for intense black eyes', 'A dermatologically tested kohl pencil that glides on smoothly and stays put through humidity and long days.', 249, 349, '["https://images.unsplash.com/photo-1631214503851-ae4d7d51f19f?w=800&q=80"]', 300, false, '{"shade":"Jet Black","benefit":"Waterproof","duration":"12-hour"}', ARRAY['kajal','kohl','eyes','makeup']),
  ('makeup', 'radiance-primer', 'Radiance Primer', 'Glow-boosting primer for smooth makeup application', 'Prep your skin with this illuminating primer that minimises pores and extends makeup wear.', 799, 999, '["https://images.unsplash.com/photo-1629198688000-71f23e745b6e?w=800&q=80"]', 150, false, '{"benefit":"Pore-minimising","finish":"Dewy","skin_type":"All"}', ARRAY['primer','makeup','face']),
  ('skincare', 'vitamin-c-brightening-serum', 'Vitamin C Brightening Serum', '10% vitamin C serum for glowing skin', 'A lightweight serum that targets dullness and dark spots, leaving skin visibly brighter and more even-toned.', 799, 999, '["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80"]', 180, true, '{"key_ingredient":"Vitamin C","skin_type":"All","benefit":"Brightening"}', ARRAY['serum','skincare','vitamin c']),
  ('skincare', 'hyaluronic-moisturizer', 'Hyaluronic Moisturizer', 'Oil-free gel moisturiser for deep hydration', 'A refreshing gel-cream packed with hyaluronic acid that hydrates without greasiness, perfect for humid Indian summers.', 649, 849, '["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80"]', 250, true, '{"key_ingredient":"Hyaluronic Acid","skin_type":"Oily/Combination","benefit":"Hydration"}', ARRAY['moisturiser','skincare','hydration']),
  ('skincare', 'salicylic-acid-cleanser', 'Salicylic Acid Cleanser', 'Gentle exfoliating cleanser for clear skin', 'A daily foaming cleanser with 2% salicylic acid to unclog pores and reduce breakouts.', 549, 699, '["https://images.unsplash.com/photo-1556228578-0d0b5a7a2b0e?w=800&q=80"]', 220, false, '{"key_ingredient":"Salicylic Acid","skin_type":"Oily/Acne-prone","benefit":"Pore-clearing"}', ARRAY['cleanser','skincare','acne']),
  ('skincare', 'spf50-sunscreen-gel', 'SPF 50 Sunscreen Gel', 'Invisible, non-sticky sunscreen for daily protection', 'A broad-spectrum sunscreen gel that absorbs quickly and leaves no white cast, ideal for daily Indian wear.', 699, 899, '["https://images.unsplash.com/photo-1556228578-0d0b5a7a2b0e?w=800&q=80"]', 300, true, '{"spf":"50","finish":"Invisible","benefit":"Sun protection"}', ARRAY['sunscreen','skincare','spf']),
  ('skincare', 'overnight-retinol-cream', 'Overnight Retinol Cream', 'Anti-ageing night cream with retinol', 'A gentle retinol cream that works overnight to reduce fine lines and improve skin texture.', 999, 1299, '["https://images.unsplash.com/photo-1571781926291-c477eb8350f2?w=800&q=80"]', 110, false, '{"key_ingredient":"Retinol","skin_type":"Mature/Normal","benefit":"Anti-ageing"}', ARRAY['night cream','skincare','retinol']),
  ('haircare', 'argan-oil-shampoo', 'Argan Oil Shampoo', 'Nourishing shampoo for dry, frizzy hair', 'Enriched with Moroccan argan oil to cleanse gently while restoring softness and shine.', 599, 749, '["https://images.unsplash.com/photo-1608248543803-ba4f8c70cd0c?w=800&q=80"]', 180, true, '{"key_ingredient":"Argan Oil","hair_type":"Dry/Frizzy","benefit":"Nourishing"}', ARRAY['shampoo','haircare','argan']),
  ('haircare', 'onion-hair-oil', 'Onion Hair Oil', 'Hair growth oil with red onion extract', 'A traditional-inspired hair oil blend with red onion extract and biotin to strengthen roots and reduce hair fall.', 499, 649, '["https://images.unsplash.com/photo-1608248543803-ba4f8c70cd0c?w=800&q=80"]', 240, true, '{"key_ingredient":"Red Onion Extract","hair_type":"All","benefit":"Hair growth"}', ARRAY['hair oil','haircare','onion']),
  ('haircare', 'smoothing-conditioner', 'Smoothing Conditioner', 'Keratin-infused conditioner for silky hair', 'A daily conditioner that detangles, smooths frizz, and adds a healthy-looking shine.', 549, 699, '["https://images.unsplash.com/photo-1608248543803-ba4f8c70cd0c?w=800&q=80"]', 160, false, '{"key_ingredient":"Keratin","hair_type":"Frizzy","benefit":"Smoothing"}', ARRAY['conditioner','haircare','keratin']),
  ('haircare', 'curl-defining-cream', 'Curl Defining Cream', 'Lightweight cream for bouncy, defined curls', 'Defines curls without crunch, fights humidity, and adds natural bounce for wavy and curly hair.', 699, 899, '["https://images.unsplash.com/photo-1608248543803-ba4f8c70cd0c?w=800&q=80"]', 130, false, '{"hair_type":"Curly/Wavy","benefit":"Definition","hold":"Soft"}', ARRAY['curl cream','haircare','curly']),
  ('fragrances', 'oud-royal-perfume', 'Oud Royal Perfume', 'Long-lasting oriental oud fragrance', 'A rich, warm oud fragrance with notes of saffron, rose, and amber — perfect for special occasions.', 2499, 3299, '["https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80"]', 75, true, '{"notes":"Oud, Saffron, Amber","longevity":"Long-lasting","occasion":"Evening"}', ARRAY['perfume','fragrance','oud']),
  ('fragrances', 'floral-body-mist', 'Floral Body Mist', 'Light, fresh floral mist for everyday wear', 'A refreshing body mist with jasmine and peony notes that can be layered or worn alone.', 499, 699, '["https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80"]', 200, true, '{"notes":"Jasmine, Peony","longevity":"Light","occasion":"Daily"}', ARRAY['body mist','fragrance','floral']),
  ('fragrances', 'citrus-cologne', 'Citrus Cologne', 'Zesty citrus cologne for men and women', 'A bright, energising blend of bergamot, lemon, and neroli for a clean, confident scent.', 1799, 2299, '["https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80"]', 90, false, '{"notes":"Bergamot, Lemon, Neroli","longevity":"Moderate","occasion":"Daytime"}', ARRAY['cologne','fragrance','citrus']),
  ('beauty-accessories', 'makeup-brush-set', 'Makeup Brush Set', '10-piece vegan makeup brush set', 'A complete set of soft, cruelty-free brushes for face and eyes, housed in a travel pouch.', 1299, 1699, '["https://images.unsplash.com/photo-1596462502278-27bfdd403348?w=800&q=80"]', 100, true, '{"pieces":"10","material":"Vegan bristles","includes":"Face + eye brushes"}', ARRAY['brushes','makeup tools','accessories']),
  ('beauty-accessories', 'rose-quartz-roller', 'Rose Quartz Roller', 'Facial massage roller for glowing skin', 'A cooling rose quartz roller that helps reduce puffiness and boost circulation during your skincare routine.', 799, 999, '["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80"]', 140, false, '{"material":"Rose Quartz","benefit":"De-puffing","use":"Face massage"}', ARRAY['roller','skincare tools','accessories']),
  ('beauty-accessories', 'microfibre-makeup-remover-cloth', 'Microfibre Makeup Remover Cloth', 'Reusable soft cloth that removes makeup with water', 'An eco-friendly microfibre cloth that gently removes makeup using only water, washable up to 200 times.', 399, 599, '["https://images.unsplash.com/photo-1556228578-0d0b5a7a2b0e?w=800&q=80"]', 300, false, '{"material":"Microfibre","benefit":"Reusable","use":"Makeup removal"}', ARRAY['makeup remover','accessories','eco-friendly'])
) as p(category_slug, slug, name, short_description, description, price_inr, compare_price_inr, images, stock, is_featured, attributes, tags)
on c.slug = p.category_slug;
