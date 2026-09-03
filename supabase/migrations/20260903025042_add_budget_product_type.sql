-- The catalogue is now organised into three customer-facing collections:
-- Korean beauty, Organic beauty and Budget beauty.
--
-- 'regular' stays in the enum (Postgres cannot drop enum values without
-- recreating the type) but is no longer offered in the admin UI or storefront
-- filters. The previous migration already re-tagged every row to 'korean', so
-- nothing is left on 'regular'.
alter type public.product_type add value if not exists 'budget';
