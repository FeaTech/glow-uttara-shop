-- ============================================================================
-- Storage bucket for admin-uploaded product images.
-- Public read; only admins may upload / update / delete.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
