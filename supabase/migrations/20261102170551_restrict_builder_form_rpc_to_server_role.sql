revoke insert on public.builder_form_submissions from anon, authenticated;
drop policy if exists builder_form_submissions_insert_published_form on public.builder_form_submissions;

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
security invoker
set search_path = ''
as $$
declare
  v_site_id uuid;
  v_page_id uuid;
  v_submission_id uuid;
  v_inserted integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
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
     or (nullif(btrim(coalesce(p_email, '')), '') is not null and btrim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$')
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

  perform pg_catalog.set_config('app.builder_form_ip', p_ip_address::text, true);
  v_submission_id := pg_catalog.gen_random_uuid();
  insert into public.builder_form_submissions (
    id, site_id, page_id, form_kind, name, email, phone, message,
    preferred_date, preferred_time, party_size
  ) values (
    v_submission_id, v_site_id, v_page_id, p_form_kind, btrim(p_name),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    btrim(p_message), p_preferred_date, p_preferred_time, p_party_size
  );
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return null;
  end if;
  return v_submission_id;
end;
$$;

revoke all on function public.submit_builder_form(text, text, text, text, text, text, text, text, date, time, smallint, text, integer, inet) from public, anon, authenticated;
grant execute on function public.submit_builder_form(text, text, text, text, text, text, text, text, date, time, smallint, text, integer, inet) to service_role;

notify pgrst, 'reload schema';
