create unique index if not exists builder_pages_one_home_per_locale_idx
on public.builder_pages(site_id,locale)
where is_home=true;
