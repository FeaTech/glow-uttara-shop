Build FEAGlam, a Clean & Glam-styled cosmetics and beauty e-commerce platform for the Indian market, using the already-connected external Supabase project. Deliver the full shopping flow: browse, cart, checkout, auth, orders, and profile/address management.

```text
src/routes/
  __root.tsx          site shell (header, footer, auth state)
  index.tsx           hero + featured categories + trending products
  products.tsx        /products (filterable catalog)
  products.$slug.tsx /products/:slug (product detail, add to cart)
  cart.tsx            /cart (review + quantity + remove)
  checkout.tsx        /checkout (shipping + payment placeholder + place order)
  _authenticated/
    route.tsx         protected layout (managed by Supabase integration)
    orders.tsx        /orders (order history)
    order.$id.tsx     /orders/:id (order detail)
    profile.tsx       /profile (name, phone, addresses)
  auth.tsx            /auth (sign in / sign up)
  reset-password.tsx  /reset-password

src/lib/
  products.functions.ts   public product queries
  cart.functions.ts       authenticated cart CRUD
  orders.functions.ts     authenticated order creation/history
  profile.functions.ts    authenticated profile/address CRUD

supabase schema:
  profiles (id fk auth.users, full_name, phone, avatar_url)
  addresses (id, profile_id, label, line1, line2, city, state, pincode, country, is_default)
  categories (id, slug, name, description, image_url)
  products (id, slug, name, description, price_inr, compare_price_inr, category_id, images, stock, is_featured, attributes)
  product_variants (id, product_id, variant_name, price_inr, stock, sku)
  cart (id, user_id, status)
  cart_items (id, cart_id, product_id, variant_id, quantity)
  orders (id, user_id, status, total_inr, shipping_address, payment_status)
  order_items (id, order_id, product_id, variant_id, quantity, price_inr)

All user tables use RLS. Public reads for categories/products via TO anon SELECT policies. Writes restricted to authenticated owners. Seed categories (Makeup, Skincare, Haircare, Fragrances, Beauty Accessories) and ~20 realistic Indian-market sample products.

Design system: update src/styles.css with Clean & Glam tokens (cream backgrounds, warm neutrals, rose-gold accent, elegant serif display font + clean sans-serif body). Generate hero/category images matching the palette.

Auth: use Supabase Auth email/password. Create /auth and /reset-password routes. Wire onAuthStateChange in __root.tsx to invalidate router/query cache. Header shows sign-in/sign-out state.

Cart: authenticated server functions; cart created on first add. Guest cart not in scope.

Checkout: simple Indian address form, COD/payment placeholder, creates order and order_items, clears cart.

SEO: unique head() titles/descriptions/og tags on every leaf route; sitemap.xml and robots.txt.

Verification: build:dev passes, sample products render on home and catalog, add-to-cart and checkout flow works end-to-end in preview.
