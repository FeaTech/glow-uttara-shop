-- ============================================================================
-- PERFORMANCE FIX #8 — multiple permissive RLS policies (found by the Supabase
-- performance linter, verified against the live database)
--
-- When a table has two PERMISSIVE policies for the same role+command, Postgres
-- evaluates BOTH on every query. Two overlaps were costing real work:
--
--   1. Catalog tables (products / categories / product_variants) each had an
--      admin "FOR ALL" policy, whose SELECT arm overlapped the public-read
--      policy. Result: every authenticated catalog read also ran
--      has_role() — a SECURITY DEFINER lookup into user_roles — even for
--      ordinary shoppers. `products` alone had 10,654 sequential scans.
--      Fix: admin policies are restricted to INSERT/UPDATE/DELETE; public read
--      already covers SELECT, so no access changes.
--
--   2. orders / order_items / profiles / referral_commissions / reviews each
--      had a user policy AND an admin policy for the same command. Merging
--      them into a single OR'd policy lets the cheap ownership check
--      short-circuit before the expensive has_role() call.
--
-- Access semantics are unchanged throughout — only the number of policy
-- evaluations per query.
--
-- Idempotent: every create is preceded by a matching `drop policy if exists`.
-- ============================================================================

-- ---- Catalog: admin write-only, public read untouched ----------------------
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can insert products" on public.products for insert to authenticated
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins can update products" on public.products for update to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)))
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins can delete products" on public.products for delete to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "Admins can manage categories" on public.categories;
drop policy if exists "Admins can insert categories" on public.categories;
drop policy if exists "Admins can update categories" on public.categories;
drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can insert categories" on public.categories for insert to authenticated
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins can update categories" on public.categories for update to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)))
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins can delete categories" on public.categories for delete to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)));

drop policy if exists "Admins can manage product variants" on public.product_variants;
drop policy if exists "Admins can insert product variants" on public.product_variants;
drop policy if exists "Admins can update product variants" on public.product_variants;
drop policy if exists "Admins can delete product variants" on public.product_variants;
create policy "Admins can insert product variants" on public.product_variants for insert to authenticated
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins can update product variants" on public.product_variants for update to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)))
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins can delete product variants" on public.product_variants for delete to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)));

-- ---- Orders / order items: merge user + admin SELECT ------------------------
drop policy if exists "Users can view their own orders" on public.orders;
drop policy if exists "Admins can view all orders" on public.orders;
drop policy if exists "Users view own orders, admins view all" on public.orders;
create policy "Users view own orders, admins view all" on public.orders for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_role((select auth.uid()), 'admin'::app_role))
  );

drop policy if exists "Users can view their own order items" on public.order_items;
drop policy if exists "Admins can view all order items" on public.order_items;
drop policy if exists "Users view own order items, admins view all" on public.order_items;
create policy "Users view own order items, admins view all" on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
    or (select public.has_role((select auth.uid()), 'admin'::app_role))
  );

-- ---- Profiles ---------------------------------------------------------------
drop policy if exists "Users can manage their own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users view own profile, admins view all" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users view own profile, admins view all" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Users can insert their own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "Users can update their own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Users can delete their own profile" on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

-- ---- Referral commissions ---------------------------------------------------
drop policy if exists "Admins manage commissions" on public.referral_commissions;
drop policy if exists "Users read own commissions" on public.referral_commissions;
drop policy if exists "Users read own commissions, admins read all" on public.referral_commissions;
drop policy if exists "Admins insert commissions" on public.referral_commissions;
drop policy if exists "Admins update commissions" on public.referral_commissions;
drop policy if exists "Admins delete commissions" on public.referral_commissions;
create policy "Users read own commissions, admins read all" on public.referral_commissions for select to authenticated
  using (beneficiary_user_id = (select auth.uid()) or (select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins insert commissions" on public.referral_commissions for insert to authenticated
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins update commissions" on public.referral_commissions for update to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)))
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins delete commissions" on public.referral_commissions for delete to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)));

-- ---- Referral settings ------------------------------------------------------
drop policy if exists "Admins manage referral settings" on public.referral_settings;
drop policy if exists "Admins insert referral settings" on public.referral_settings;
drop policy if exists "Admins update referral settings" on public.referral_settings;
drop policy if exists "Admins delete referral settings" on public.referral_settings;
create policy "Admins insert referral settings" on public.referral_settings for insert to authenticated
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins update referral settings" on public.referral_settings for update to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)))
  with check ((select public.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Admins delete referral settings" on public.referral_settings for delete to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::app_role)));

-- ---- Reviews: merge the two DELETE policies --------------------------------
drop policy if exists "Admins can delete reviews" on public.reviews;
drop policy if exists "Users can delete their own reviews" on public.reviews;
drop policy if exists "Users delete own reviews, admins delete any" on public.reviews;
create policy "Users delete own reviews, admins delete any" on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role((select auth.uid()), 'admin'::app_role)));
