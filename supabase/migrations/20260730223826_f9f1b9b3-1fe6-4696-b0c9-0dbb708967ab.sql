-- Referral program schema
create type public.referral_commission_status as enum ('pending','approved','paid','cancelled');

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists referral_registered_at timestamptz;

create or replace function public.generate_referral_code()
returns text language plpgsql as $$
declare code text;
begin
  loop
    code := 'FEA' || upper(substr(md5(gen_random_uuid()::text), 1, 7));
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

update public.profiles set referral_code = public.generate_referral_code() where referral_code is null;

alter table public.profiles alter column referral_code set default public.generate_referral_code();
alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);

-- Settings (singleton)
create table public.referral_settings (
  id boolean primary key default true,
  program_enabled boolean not null default true,
  level_1_percentage numeric(5,2) not null default 10,
  level_2_percentage numeric(5,2) not null default 5,
  approval_waiting_days integer not null default 7,
  minimum_payout_amount integer not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint referral_settings_singleton check (id)
);
insert into public.referral_settings (id) values (true);

grant select on public.referral_settings to authenticated;
grant all on public.referral_settings to service_role;
alter table public.referral_settings enable row level security;
create policy "Anyone signed in can read referral settings"
  on public.referral_settings for select to authenticated using (true);
create policy "Admins manage referral settings"
  on public.referral_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Commissions
create table public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  beneficiary_user_id uuid not null,
  purchasing_user_id uuid not null,
  referral_level smallint not null check (referral_level in (1,2)),
  commission_percentage numeric(5,2) not null,
  eligible_order_amount integer not null default 0,
  commission_amount integer not null default 0,
  adjustment_amount integer not null default 0,
  adjustment_reason text,
  status public.referral_commission_status not null default 'pending',
  approved_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, beneficiary_user_id, referral_level)
);
create index referral_commissions_beneficiary_idx on public.referral_commissions (beneficiary_user_id);

grant select on public.referral_commissions to authenticated;
grant all on public.referral_commissions to service_role;
alter table public.referral_commissions enable row level security;
create policy "Users read own commissions"
  on public.referral_commissions for select to authenticated
  using (auth.uid() = beneficiary_user_id);
create policy "Admins manage commissions"
  on public.referral_commissions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Audit
create table public.referral_commission_audit (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.referral_commissions(id) on delete cascade,
  action text not null,
  previous_status public.referral_commission_status,
  new_status public.referral_commission_status,
  amount_delta integer not null default 0,
  reason text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.referral_commission_audit to authenticated;
grant all on public.referral_commission_audit to service_role;
alter table public.referral_commission_audit enable row level security;
create policy "Admins read commission audit"
  on public.referral_commission_audit for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- Link referrer on signup (metadata referral_code)
create or replace function public.handle_new_user_referral()
returns trigger language plpgsql security definer set search_path = public as $$
declare ref_code text; ref_user uuid;
begin
  ref_code := upper(nullif(trim(coalesce(new.raw_user_meta_data->>'referral_code','')), ''));
  if ref_code is not null then
    select id into ref_user from public.profiles where referral_code = ref_code;
    if ref_user is not null and ref_user <> new.id then
      update public.profiles
        set referred_by_user_id = ref_user, referral_registered_at = now()
        where id = new.id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user_referral() from public, anon, authenticated;

create trigger on_auth_user_created_referral
  after insert on auth.users
  for each row execute function public.handle_new_user_referral();

-- Create commissions when an order becomes paid
create or replace function public.create_referral_commissions()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record; l1 uuid; l2 uuid; eligible integer;
begin
  if new.payment_status <> 'paid' or (tg_op = 'UPDATE' and old.payment_status = 'paid') then
    return new;
  end if;
  select * into s from public.referral_settings where id;
  if not found or not s.program_enabled then return new; end if;

  select referred_by_user_id into l1 from public.profiles where id = new.user_id;
  if l1 is null then return new; end if;
  select referred_by_user_id into l2 from public.profiles where id = l1;

  eligible := greatest(0, coalesce(new.subtotal_inr, new.total_inr) - coalesce(new.discount_inr, 0));

  insert into public.referral_commissions
    (order_id, beneficiary_user_id, purchasing_user_id, referral_level, commission_percentage, eligible_order_amount, commission_amount)
  values (new.id, l1, new.user_id, 1, s.level_1_percentage, eligible, floor(eligible * s.level_1_percentage / 100))
  on conflict do nothing;

  if l2 is not null and l2 <> new.user_id then
    insert into public.referral_commissions
      (order_id, beneficiary_user_id, purchasing_user_id, referral_level, commission_percentage, eligible_order_amount, commission_amount)
    values (new.id, l2, new.user_id, 2, s.level_2_percentage, eligible, floor(eligible * s.level_2_percentage / 100))
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.create_referral_commissions() from public, anon, authenticated;

create trigger orders_create_referral_commissions
  after insert or update of payment_status on public.orders
  for each row execute function public.create_referral_commissions();

-- Auto-approve commissions past the waiting window
create or replace function public.approve_due_referral_commissions()
returns integer language plpgsql security definer set search_path = public as $$
declare days integer; n integer;
begin
  select approval_waiting_days into days from public.referral_settings where id;
  update public.referral_commissions
    set status = 'approved', approved_at = now()
  where status = 'pending'
    and created_at < now() - make_interval(days => coalesce(days, 7));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.approve_due_referral_commissions() from public, anon;