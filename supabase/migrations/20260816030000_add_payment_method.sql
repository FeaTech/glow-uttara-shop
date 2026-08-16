-- Add payment_method column to orders (COD vs online/prepaid).
-- Defaults to 'cod' so existing rows get a sensible value.
alter table public.orders
  add column if not exists payment_method text not null default 'cod'
  check (payment_method in ('cod', 'online'));
