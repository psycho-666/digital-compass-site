create index if not exists builder_sites_created_by_idx
on public.builder_sites(created_by);

create index if not exists builder_page_versions_created_by_idx
on public.builder_page_versions(created_by);
