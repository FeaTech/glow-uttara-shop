-- Differentiate products by type (e.g. organic vs. Korean beauty) so we can
-- filter/badge the storefront as the organic range is introduced.
create type public.product_type as enum ('regular', 'organic', 'korean');

alter table public.products
  add column if not exists product_type public.product_type not null default 'regular';

comment on column public.products.product_type is
  'Marketing/origin classification for a product (regular, organic, korean).';
