create policy "Admins can view all customer addresses"
  on public.addresses for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role));
