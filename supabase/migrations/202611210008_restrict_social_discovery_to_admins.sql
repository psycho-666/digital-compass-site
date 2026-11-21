drop policy if exists "Authenticated can read social discovery queries" on public.social_discovery_queries;
create policy "Admins can read social discovery queries" on public.social_discovery_queries for select to authenticated using (((select auth.jwt())->'app_metadata'->>'role')='admin');
drop policy if exists "Authenticated can read social discovery runs" on public.social_discovery_runs;
create policy "Admins can read social discovery runs" on public.social_discovery_runs for select to authenticated using (((select auth.jwt())->'app_metadata'->>'role')='admin');
drop policy if exists "Authenticated can read social discovery candidates" on public.social_discovery_candidates;
create policy "Admins can read social discovery candidates" on public.social_discovery_candidates for select to authenticated using (((select auth.jwt())->'app_metadata'->>'role')='admin');