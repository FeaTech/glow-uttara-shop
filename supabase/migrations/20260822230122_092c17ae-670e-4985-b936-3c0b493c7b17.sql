CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', new.phone, '')), '')
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$function$;

UPDATE public.profiles p
SET full_name = coalesce(nullif(trim(coalesce(p.full_name,'')),''), nullif(trim(coalesce(u.raw_user_meta_data->>'full_name','')),'')),
    phone = coalesce(nullif(trim(coalesce(p.phone,'')),''), nullif(trim(coalesce(u.raw_user_meta_data->>'phone', u.phone, '')),''))
FROM auth.users u
WHERE u.id = p.id;