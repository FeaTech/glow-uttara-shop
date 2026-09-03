-- New products default to the Korean beauty collection rather than the legacy
-- 'regular' value, which is no longer offered anywhere in the UI.
--
-- Split from the enum migration above: Postgres will not let a newly added
-- enum value be referenced in the same transaction that adds it.
alter table public.products
  alter column product_type set default 'korean';

comment on column public.products.product_type is
  'Customer-facing collection for a product (korean, organic, budget). "regular" is legacy and unused.';
