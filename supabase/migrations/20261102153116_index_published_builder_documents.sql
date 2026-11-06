create index if not exists builder_published_document_gin_idx
on public.builder_page_versions using gin (document jsonb_path_ops)
where status='published';
