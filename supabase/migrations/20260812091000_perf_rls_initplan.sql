-- ============================================================================
-- PERFORMANCE FIX #2 — stop RLS re-evaluating auth.uid()/has_role() per row
--
-- Postgres treats `auth.uid()` inside a policy as a volatile-ish expression and
-- re-evaluates it for EVERY row scanned. Wrapping it in a scalar subquery
-- `(select auth.uid())` lets the planner hoist it into an InitPlan that runs
-- ONCE per query. Same for `has_role(...)`, which is far more expensive because
-- it is a SECURITY DEFINER function that queries user_roles — previously that
-- ran once per row scanned on every admin page.
-- (This is Supabase's documented `auth_rls_initplan` lint.)
--
-- This migration rewrites policies programmatically from pg_policies rather
-- than hardcoding definitions, so it stays correct regardless of any policy
-- changes made since. Only the function calls are wrapped — the boolean logic
-- of every policy is preserved exactly.
-- ============================================================================

do $$
declare
  r record;
  new_qual text;
  new_check text;
  stmt text;
  roles_csv text;
  rewritten integer := 0;
begin
  for r in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
      -- Skip anything already wrapped in a subselect.
      and coalesce(qual, '') !~* 'select auth\.uid\(\)'
      and coalesce(with_check, '') !~* 'select auth\.uid\(\)'
  loop
    new_qual := r.qual;
    new_check := r.with_check;

    -- 1) Hoist auth.uid() into an InitPlan.
    new_qual  := replace(new_qual,  'auth.uid()', '(select auth.uid())');
    new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');

    -- 2) Hoist the whole has_role(...) predicate so the SECURITY DEFINER
    --    function runs once per query instead of once per row.
    new_qual := replace(
      new_qual,
      'has_role((select auth.uid()), ''admin''::app_role)',
      '(select public.has_role((select auth.uid()), ''admin''::app_role))'
    );
    new_check := replace(
      new_check,
      'has_role((select auth.uid()), ''admin''::app_role)',
      '(select public.has_role((select auth.uid()), ''admin''::app_role))'
    );

    roles_csv := array_to_string(r.roles, ', ');

    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);

    stmt := format(
      'create policy %I on %I.%I as %s for %s to %s',
      r.policyname, r.schemaname, r.tablename,
      case when r.permissive = 'RESTRICTIVE' then 'restrictive' else 'permissive' end,
      r.cmd,
      roles_csv
    );

    -- USING is invalid for INSERT; WITH CHECK is invalid for SELECT/DELETE.
    if new_qual is not null and r.cmd <> 'INSERT' then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null and r.cmd in ('INSERT', 'UPDATE', 'ALL') then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;

    execute stmt;
    rewritten := rewritten + 1;
  end loop;

  raise notice 'RLS initplan optimisation: rewrote % policies', rewritten;
end
$$;
