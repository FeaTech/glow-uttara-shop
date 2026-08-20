create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- Backfill existing profiles where the auth metadata has a full_name but the profile does not
update public.profiles p
set full_name = u.raw_user_meta_data->>'full_name'
from auth.users u
where p.id = u.id
  and (p.full_name is null or p.full_name = '')
  and (u.raw_user_meta_data->>'full_name' is not null and u.raw_user_meta_data->>'full_name' != '');