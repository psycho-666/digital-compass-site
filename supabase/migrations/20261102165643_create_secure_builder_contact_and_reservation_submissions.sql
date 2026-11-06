create table public.builder_form_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.builder_sites(id) on delete cascade,
  page_id uuid not null references public.builder_pages(id) on delete cascade,
  form_kind text not null check (form_kind in ('contact', 'reservation')),
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  message text not null check (char_length(message) between 1 and 4000),
  preferred_date date,
  preferred_time time,
  party_size smallint check (party_size is null or party_size between 1 and 30),
  created_at timestamptz not null default now(),
  constraint builder_form_reservation_fields_check check (
    (form_kind = 'contact')
    or (form_kind = 'reservation' and preferred_date is not null and preferred_time is not null and party_size is not null)
  )
);

create index builder_form_submissions_site_created_idx
  on public.builder_form_submissions (site_id, created_at desc);
create index builder_form_submissions_page_created_idx
  on public.builder_form_submissions (page_id, created_at desc);

create table public.builder_form_rate_limits (
  site_id uuid not null references public.builder_sites(id) on delete cascade,
  ip_address inet not null,
  window_started_at timestamptz not null,
  submission_count integer not null check (submission_count > 0),
  primary key (site_id, ip_address)
);

alter table public.builder_form_submissions enable row level security;
alter table public.builder_form_rate_limits enable row level security;

revoke all on public.builder_form_submissions from public, anon, authenticated;
revoke all on public.builder_form_rate_limits from public, anon, authenticated;
grant select on public.builder_form_submissions to authenticated;

create policy builder_form_submissions_read_site_admins
on public.builder_form_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.builder_sites s
    join public.builder_workspace_members m on m.workspace_id = s.workspace_id
    where s.id = builder_form_submissions.site_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

create or replace function public.submit_builder_form(
  p_site_slug text,
  p_page_slug text,
  p_locale text,
  p_form_kind text,
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_preferred_date date,
  p_preferred_time time,
  p_party_size smallint,
  p_honeypot text,
  p_elapsed_ms integer,
  p_ip_address inet
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_id uuid;
  v_page_id uuid;
  v_count integer;
  v_submission_id uuid;
begin
  if coalesce(auth.jwt()->>'role', '') not in ('anon', 'authenticated') then
    raise exception 'invalid_role';
  end if;
  if coalesce(p_honeypot, '') <> '' or coalesce(p_elapsed_ms, 0) < 1500 then
    raise exception 'spam_detected';
  end if;
  if p_ip_address is null
     or p_locale not in ('ar', 'en')
     or p_form_kind not in ('contact', 'reservation')
     or char_length(btrim(coalesce(p_name, ''))) not between 1 and 120
     or char_length(coalesce(p_email, '')) > 254
     or char_length(coalesce(p_phone, '')) > 40
     or char_length(btrim(coalesce(p_message, ''))) not between 1 and 4000
     or (nullif(btrim(coalesce(p_email, '')), '') is null and nullif(btrim(coalesce(p_phone, '')), '') is null)
     or (nullif(btrim(coalesce(p_email, '')), '') is not null and btrim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$')
  then
    raise exception 'invalid_form';
  end if;
  if p_form_kind = 'reservation'
     and (p_preferred_date is null or p_preferred_date < current_date
       or p_preferred_time is null or p_party_size is null or p_party_size not between 1 and 30)
  then
    raise exception 'invalid_reservation';
  end if;

  select s.id, p.id
    into v_site_id, v_page_id
  from public.builder_sites s
  join public.builder_pages p on p.site_id = s.id
  join public.builder_page_versions v on v.page_id = p.id
  where s.slug = p_site_slug
    and p.slug = p_page_slug
    and p.locale = p_locale
    and v.status = 'published'
    and v.document @> jsonb_build_object(
      'blocks',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'form',
          'props', jsonb_build_object('formKind', p_form_kind)
        )
      )
    )
  order by v.version_no desc
  limit 1;

  if v_site_id is null or v_page_id is null then
    raise exception 'form_not_published';
  end if;

  delete from public.builder_form_rate_limits
  where site_id = v_site_id
    and window_started_at < now() - interval '48 hours';

  insert into public.builder_form_rate_limits (site_id, ip_address, window_started_at, submission_count)
  values (v_site_id, p_ip_address, now(), 1)
  on conflict (site_id, ip_address) do update
  set submission_count = case
        when public.builder_form_rate_limits.window_started_at < now() - interval '15 minutes' then 1
        else public.builder_form_rate_limits.submission_count + 1
      end,
      window_started_at = case
        when public.builder_form_rate_limits.window_started_at < now() - interval '15 minutes' then now()
        else public.builder_form_rate_limits.window_started_at
      end
  returning submission_count into v_count;

  if v_count > 5 then
    return null;
  end if;

  insert into public.builder_form_submissions (
    site_id, page_id, form_kind, name, email, phone, message,
    preferred_date, preferred_time, party_size
  ) values (
    v_site_id, v_page_id, p_form_kind, btrim(p_name),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    btrim(p_message), p_preferred_date, p_preferred_time, p_party_size
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

revoke all on function public.submit_builder_form(text, text, text, text, text, text, text, text, date, time, smallint, text, integer, inet) from public;
revoke all on function public.submit_builder_form(text, text, text, text, text, text, text, text, date, time, smallint, text, integer, inet) from anon, authenticated;
grant execute on function public.submit_builder_form(text, text, text, text, text, text, text, text, date, time, smallint, text, integer, inet) to anon, authenticated;
