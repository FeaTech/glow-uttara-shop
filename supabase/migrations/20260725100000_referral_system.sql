-- ============================================================================
-- FEA Glam — two-level referral & commission system
--   • referral codes on profiles (immutable referrer, auto-generated code)
--   • referral_settings (program config, single row)
--   • referral_commissions (level 1 = 10%, level 2 = 5%)
--   • referral_commission_audit (full history)
--   • idempotent commission generation on successful payment
--   • cancellation / refund / clawback handling
-- All correctness enforced with constraints + SECURITY DEFINER functions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.commission_status as enum ('pending', 'approved', 'paid', 'cancelled');

-- ---------------------------------------------------------------------------
-- Referral settings (singleton row, id = true)
-- ---------------------------------------------------------------------------
create table public.referral_settings (
  id boolean primary key default true,
  program_enabled boolean not null default true,
  level_1_percentage numeric(5,2) not null default 10,
  level_2_percentage numeric(5,2) not null default 5,
  approval_waiting_days integer not null default 7,
  minimum_payout_amount integer not null default 0,
  updated_by uuid,
  updated_at timestamp with time zone not null default now(),
  constraint referral_settings_singleton check (id = true)
);

insert into public.referral_settings (id) values (true) on conflict do nothing;

grant select on public.referral_settings to authenticated;
grant all on public.referral_settings to service_role;
alter table public.referral_settings enable row level security;

create policy "Referral settings readable by authenticated"
  on public.referral_settings for select to authenticated using (true);
create policy "Admins manage referral settings"
  on public.referral_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Referral code generation
-- ---------------------------------------------------------------------------
create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  taken integer;
begin
  loop
    code := 'FEA' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    select count(*) into taken from public.profiles where referral_code = code;
    exit when taken = 0;
  end loop;
  return code;
end;
$$;

grant execute on function public.generate_referral_code() to service_role;

-- ---------------------------------------------------------------------------
-- Profiles: referral columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column referral_code text;
alter table public.profiles add column referred_by_user_id uuid references auth.users(id) on delete set null;
alter table public.profiles add column referral_registered_at timestamp with time zone;

-- Backfill codes for existing profiles (row-by-row so uniqueness is respected).
do $$
declare
  r record;
begin
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles set referral_code = public.generate_referral_code() where id = r.id;
  end loop;
end
$$;

alter table public.profiles alter column referral_code set default public.generate_referral_code();
alter table public.profiles add constraint profiles_referral_code_key unique (referral_code);
alter table public.profiles alter column referral_code set not null;
alter table public.profiles
  add constraint profiles_no_self_referral check (referred_by_user_id is null or referred_by_user_id <> id);

-- Customers may edit only their safe profile fields — never the referral fields.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, updated_at) on public.profiles to authenticated;

-- Referrer + referral_code are immutable once set (belt-and-suspenders on top of grants).
create or replace function public.protect_referral_fields()
returns trigger
language plpgsql
as $$
begin
  if old.referral_code is not null and new.referral_code is distinct from old.referral_code then
    raise exception 'referral_code cannot be changed';
  end if;
  if old.referred_by_user_id is not null and new.referred_by_user_id is distinct from old.referred_by_user_id then
    raise exception 'referrer cannot be changed once set';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_referral
  before update on public.profiles
  for each row execute function public.protect_referral_fields();

-- Attach a referrer at registration from signup metadata (`referral_code`/`ref`).
create or replace function public.handle_new_user_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  ref_user uuid;
begin
  -- Ensure a code exists (in case the profile row was created without the default).
  update public.profiles
    set referral_code = public.generate_referral_code()
    where id = new.id and referral_code is null;

  ref_code := nullif(upper(trim(coalesce(
    new.raw_user_meta_data ->> 'referral_code',
    new.raw_user_meta_data ->> 'ref'
  ))), '');

  if ref_code is not null then
    select id into ref_user
      from public.profiles
      where referral_code = ref_code and id <> new.id
      limit 1;

    -- Guard against circular relationships (referrer must not descend from the new user).
    if ref_user is not null
       and not exists (select 1 from public.profiles where id = ref_user and referred_by_user_id = new.id) then
      update public.profiles
        set referred_by_user_id = ref_user, referral_registered_at = now()
        where id = new.id and referred_by_user_id is null;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user_referral() from anon, authenticated;
grant execute on function public.handle_new_user_referral() to service_role;

-- Fires after on_auth_user_created (which inserts the profile row).
create trigger on_auth_user_created_referral
  after insert on auth.users
  for each row execute function public.handle_new_user_referral();

-- ---------------------------------------------------------------------------
-- Orders: fields used by commission lifecycle
-- ---------------------------------------------------------------------------
alter table public.orders add column is_test boolean not null default false;
alter table public.orders add column delivered_at timestamp with time zone;

-- Stamp delivered_at when an order transitions to delivered.
create or replace function public.stamp_order_delivered()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delivered' and (old.status is distinct from 'delivered') and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

create trigger orders_stamp_delivered
  before update on public.orders
  for each row execute function public.stamp_order_delivered();

-- ---------------------------------------------------------------------------
-- Referral commissions
-- ---------------------------------------------------------------------------
create table public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  purchasing_user_id uuid not null references auth.users(id) on delete cascade,
  beneficiary_user_id uuid not null references auth.users(id) on delete cascade,
  referral_level smallint not null check (referral_level in (1, 2)),
  commission_percentage numeric(5,2) not null,
  eligible_order_amount integer not null,
  commission_amount integer not null,
  status public.commission_status not null default 'pending',
  approved_at timestamp with time zone,
  paid_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  adjustment_amount integer not null default 0,
  adjustment_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint referral_commissions_no_self check (purchasing_user_id <> beneficiary_user_id),
  unique (order_id, beneficiary_user_id, referral_level)
);

create index referral_commissions_beneficiary_idx on public.referral_commissions (beneficiary_user_id);
create index referral_commissions_order_idx on public.referral_commissions (order_id);
create index referral_commissions_status_idx on public.referral_commissions (status);

grant select on public.referral_commissions to authenticated;
grant all on public.referral_commissions to service_role;
alter table public.referral_commissions enable row level security;

create policy "Beneficiaries view their own commissions"
  on public.referral_commissions for select to authenticated
  using (auth.uid() = beneficiary_user_id);
create policy "Admins view all commissions"
  on public.referral_commissions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
-- No insert/update/delete for regular users — mutations only via SECURITY DEFINER
-- functions / service role.

create trigger update_referral_commissions_updated_at
  before update on public.referral_commissions
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table public.referral_commission_audit (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid references public.referral_commissions(id) on delete cascade,
  action text not null,
  previous_status public.commission_status,
  new_status public.commission_status,
  amount_delta integer,
  reason text,
  actor_user_id uuid,
  created_at timestamp with time zone not null default now()
);

grant select on public.referral_commission_audit to authenticated;
grant all on public.referral_commission_audit to service_role;
alter table public.referral_commission_audit enable row level security;

create policy "Admins view commission audit"
  on public.referral_commission_audit for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.log_commission_audit(
  _commission_id uuid,
  _action text,
  _previous public.commission_status,
  _new public.commission_status,
  _amount_delta integer,
  _reason text,
  _actor uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.referral_commission_audit
    (commission_id, action, previous_status, new_status, amount_delta, reason, actor_user_id)
  values (_commission_id, _action, _previous, _new, _amount_delta, _reason, _actor);
$$;

revoke execute on function public.log_commission_audit(uuid, text, public.commission_status, public.commission_status, integer, text, uuid) from anon, authenticated;
grant execute on function public.log_commission_audit(uuid, text, public.commission_status, public.commission_status, integer, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Idempotent commission generation (called when payment succeeds)
-- ---------------------------------------------------------------------------
create or replace function public.generate_referral_commissions(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.referral_settings;
  o public.orders;
  eligible integer;
  l1_user uuid;
  l2_user uuid;
  amt integer;
  new_id uuid;
begin
  select * into s from public.referral_settings where id = true;
  if not found or not s.program_enabled then
    return;
  end if;

  select * into o from public.orders where id = _order_id;
  if not found then return; end if;

  -- Guards: only paid, real (non-test), non-cancelled orders generate commissions.
  if o.payment_status <> 'paid' or o.is_test or o.status = 'cancelled' then
    return;
  end if;

  -- Idempotency: bail if this order already produced commissions.
  if exists (select 1 from public.referral_commissions where order_id = _order_id) then
    return;
  end if;

  -- Eligible base = product subtotal after discount (no tax/shipping in this store).
  eligible := greatest(0, coalesce(o.total_inr, 0));
  if eligible <= 0 then return; end if;

  -- Level 1 — direct referrer of the purchaser.
  select referred_by_user_id into l1_user from public.profiles where id = o.user_id;
  if l1_user is not null and l1_user <> o.user_id then
    amt := floor(eligible * s.level_1_percentage / 100.0)::integer;
    if amt > 0 then
      insert into public.referral_commissions
        (order_id, purchasing_user_id, beneficiary_user_id, referral_level,
         commission_percentage, eligible_order_amount, commission_amount, status)
      values (_order_id, o.user_id, l1_user, 1, s.level_1_percentage, eligible, amt, 'pending')
      on conflict (order_id, beneficiary_user_id, referral_level) do nothing
      returning id into new_id;
      if new_id is not null then
        perform public.log_commission_audit(new_id, 'created', null, 'pending', amt, 'Level 1 commission generated', null);
      end if;
    end if;

    -- Level 2 — referrer of the direct referrer.
    select referred_by_user_id into l2_user from public.profiles where id = l1_user;
    if l2_user is not null and l2_user <> o.user_id and l2_user <> l1_user then
      amt := floor(eligible * s.level_2_percentage / 100.0)::integer;
      if amt > 0 then
        new_id := null;
        insert into public.referral_commissions
          (order_id, purchasing_user_id, beneficiary_user_id, referral_level,
           commission_percentage, eligible_order_amount, commission_amount, status)
        values (_order_id, o.user_id, l2_user, 2, s.level_2_percentage, eligible, amt, 'pending')
        on conflict (order_id, beneficiary_user_id, referral_level) do nothing
        returning id into new_id;
        if new_id is not null then
          perform public.log_commission_audit(new_id, 'created', null, 'pending', amt, 'Level 2 commission generated', null);
        end if;
      end if;
    end if;
  end if;
end;
$$;

revoke execute on function public.generate_referral_commissions(uuid) from anon, authenticated;
grant execute on function public.generate_referral_commissions(uuid) to service_role;

-- Trigger: generate when an order becomes paid (insert or status change).
create or replace function public.trg_generate_commissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_referral_commissions(new.id);
  return new;
end;
$$;

create trigger orders_generate_commissions
  after insert or update of payment_status on public.orders
  for each row
  when (new.payment_status = 'paid')
  execute function public.trg_generate_commissions();

-- ---------------------------------------------------------------------------
-- Cancellation / refund handling
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order_commissions(_order_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.referral_commissions;
begin
  for c in select * from public.referral_commissions where order_id = _order_id loop
    if c.status in ('pending', 'approved') then
      update public.referral_commissions
        set status = 'cancelled', cancelled_at = now()
        where id = c.id;
      perform public.log_commission_audit(c.id, 'cancelled', c.status, 'cancelled', -c.commission_amount, _reason, null);
    elsif c.status = 'paid' then
      -- Already paid: record a negative clawback to deduct from future earnings.
      update public.referral_commissions
        set adjustment_amount = adjustment_amount - c.commission_amount,
            adjustment_reason = _reason
        where id = c.id;
      perform public.log_commission_audit(c.id, 'adjusted', 'paid', 'paid', -c.commission_amount, _reason, null);
    end if;
  end loop;
end;
$$;

revoke execute on function public.cancel_order_commissions(uuid, text) from anon, authenticated;
grant execute on function public.cancel_order_commissions(uuid, text) to service_role;

create or replace function public.trg_order_commission_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.cancel_order_commissions(new.id, 'Order cancelled');
  elsif new.payment_status = 'refunded' and old.payment_status is distinct from 'refunded' then
    perform public.cancel_order_commissions(new.id, 'Order refunded');
  end if;
  return new;
end;
$$;

create trigger orders_commission_lifecycle
  after update on public.orders
  for each row execute function public.trg_order_commission_lifecycle();

-- ---------------------------------------------------------------------------
-- Approve commissions whose orders are delivered and past the waiting period.
-- ---------------------------------------------------------------------------
create or replace function public.approve_due_referral_commissions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.referral_settings;
  c record;
  n integer := 0;
begin
  select * into s from public.referral_settings where id = true;
  for c in
    select rc.id, rc.commission_amount
    from public.referral_commissions rc
    join public.orders o on o.id = rc.order_id
    where rc.status = 'pending'
      and o.status = 'delivered'
      and o.payment_status = 'paid'
      and o.delivered_at is not null
      and o.delivered_at + make_interval(days => s.approval_waiting_days) <= now()
  loop
    update public.referral_commissions
      set status = 'approved', approved_at = now()
      where id = c.id;
    perform public.log_commission_audit(c.id, 'approved', 'pending', 'approved', c.commission_amount, 'Auto-approved after waiting period', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.approve_due_referral_commissions() from anon, authenticated;
grant execute on function public.approve_due_referral_commissions() to service_role;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.referral_commissions;
