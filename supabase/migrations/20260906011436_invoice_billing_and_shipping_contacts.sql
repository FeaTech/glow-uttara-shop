-- Preserve the account holder's billing address on every new order. Existing
-- orders remain valid; their invoices fall back to the stored shipping address.
alter table public.orders
  add column if not exists billing_address jsonb;
