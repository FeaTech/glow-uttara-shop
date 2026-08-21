ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 1800,
  ADD COLUMN IF NOT EXISTS tax_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_channel text,
  ADD COLUMN IF NOT EXISTS payment_fee_rate_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_fee_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_fee_inr integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paise integer;

UPDATE public.orders SET total_paise = total_inr * 100 WHERE total_paise IS NULL;