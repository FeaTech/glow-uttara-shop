create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;

alter table public.contact_messages enable row level security;

create policy "Admins can view all contact messages"
  on public.contact_messages
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Anyone can submit a contact message"
  on public.contact_messages
  for insert
  to authenticated, anon
  with check (true);

create policy "Admins can delete contact messages"
  on public.contact_messages
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index idx_contact_messages_created_at on public.contact_messages (created_at desc);