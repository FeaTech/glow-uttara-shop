-- ============================================================================
-- Ensure realtime is reliably enabled for the shopper-facing tables.
-- Idempotent: safe to run even if the tables are already in the publication.
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events carry full row data.
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array['cart', 'cart_items', 'orders', 'order_items', 'wishlist_items', 'reviews'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end
$$;
