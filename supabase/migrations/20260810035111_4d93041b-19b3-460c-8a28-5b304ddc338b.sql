ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_unit text;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS compare_price_inr integer;