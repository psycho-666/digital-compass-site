alter table private.page_credentials enable row level security;
revoke all on table private.page_credentials from public, anon, authenticated;
grant select, insert, update, delete on table private.page_credentials to service_role;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;