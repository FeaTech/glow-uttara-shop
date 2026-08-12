-- ============================================================================
-- PERFORMANCE FIX #1 — missing indexes on hot query paths
--
-- Postgres auto-indexes PRIMARY KEY and UNIQUE constraints only; it does NOT
-- index foreign keys. Before this migration the database had 4 indexes total,
-- so order history, order detail, product pages and catalog sorting were all
-- running sequential scans.
--
-- Coverage already provided by existing UNIQUE constraints (left alone):
--   cart_items(cart_id,...)  wishlist_items(user_id,...)
--   reviews(product_id,...)  user_roles(user_id,...)  cart(user_id,status)
-- ============================================================================

-- ---- Orders: "My orders" list + every RLS check on orders --------------------
create index if not exists orders_user_id_idx on public.orders (user_id);
-- Serves `where user_id = ? order by created_at desc` from a single index.
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
-- Admin filtering / commission approval sweeps.
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);

-- ---- Order items: joined on every order read, and used by the order_items ----
-- RLS policy's correlated EXISTS subquery into orders.
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

-- ---- Product variants: joined on every product detail page + admin inventory -
create index if not exists product_variants_product_id_idx on public.product_variants (product_id);

-- ---- Products: category filter, default sort, featured rail -----------------
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists products_featured_idx on public.products (is_featured) where is_featured;
-- Sort options exposed in the catalog UI.
create index if not exists products_price_idx on public.products (price_inr);
create index if not exists products_rating_idx on public.products (rating_avg desc, rating_count desc);

-- ---- Cart item foreign keys -------------------------------------------------
create index if not exists cart_items_product_id_idx on public.cart_items (product_id);
create index if not exists cart_items_variant_id_idx on public.cart_items (variant_id) where variant_id is not null;

-- ---- Addresses / profiles / reviews ----------------------------------------
create index if not exists addresses_profile_id_idx on public.addresses (profile_id);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by_user_id) where referred_by_user_id is not null;
create index if not exists reviews_user_id_idx on public.reviews (user_id);

-- ---- Product search --------------------------------------------------------
-- listProducts/quickSearchProducts use ILIKE '%term%', which cannot use a
-- btree index and forces a full scan on every search. Trigram GIN indexes make
-- these substring searches indexable.
create extension if not exists pg_trgm;
create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);
create index if not exists products_short_desc_trgm_idx
  on public.products using gin (short_description gin_trgm_ops);

analyze public.orders;
analyze public.order_items;
analyze public.products;
analyze public.product_variants;
analyze public.cart_items;
