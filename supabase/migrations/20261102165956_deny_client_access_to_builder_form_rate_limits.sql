create policy builder_form_rate_limits_no_client_access
on public.builder_form_rate_limits
for all
to anon, authenticated
using (false)
with check (false);
