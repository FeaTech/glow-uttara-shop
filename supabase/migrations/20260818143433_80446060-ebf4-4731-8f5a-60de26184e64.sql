alter table public.orders
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

create index if not exists orders_razorpay_order_id_idx on public.orders (razorpay_order_id);