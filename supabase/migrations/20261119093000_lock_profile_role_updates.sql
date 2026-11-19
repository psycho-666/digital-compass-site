drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_admin_only on public.profiles
for update using (public.is_social_owner())
with check (public.is_social_owner());
