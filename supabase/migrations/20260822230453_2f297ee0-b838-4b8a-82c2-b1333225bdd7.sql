alter table public.profiles add column if not exists email text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', new.phone, '')), ''),
    nullif(trim(coalesce(new.email, '')), '')
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone),
        email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$function$;

UPDATE public.profiles p
SET email = coalesce(nullif(trim(coalesce(p.email,'')),''), nullif(trim(coalesce(u.email,'')),''))
FROM auth.users u
WHERE u.id = p.id;