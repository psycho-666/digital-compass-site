create table public.builder_blog_categories(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 120),slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,80}$'),
 description text not null default '',created_at timestamptz not null default now(),unique(site_id,slug),unique(id,site_id)
);
create table public.builder_blog_posts(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,
 category_id uuid,title text not null check(char_length(title) between 1 and 200),
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,100}$'),
 excerpt text not null default '',content text not null default '',status text not null default 'draft' check(status in ('draft','published','scheduled','archived')),
 author_name text not null default '',cover_image_path text,seo_title text not null default '',seo_description text not null default '',
 allow_comments boolean not null default true,published_at timestamptz,scheduled_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(site_id,slug),unique(id,site_id),
 foreign key(category_id,site_id) references public.builder_blog_categories(id,site_id) on delete set null(category_id)
);
create index builder_blog_posts_public_idx on public.builder_blog_posts(site_id,status,published_at desc);
create index builder_blog_posts_category_site_idx on public.builder_blog_posts(category_id,site_id) where category_id is not null;
create table public.builder_blog_comments(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,
 post_id uuid not null,parent_id uuid references public.builder_blog_comments(id) on delete set null,
 author_name text not null check(char_length(author_name) between 1 and 120),
 author_email text not null default '' check(char_length(author_email)<=254),
 body text not null check(char_length(body) between 1 and 4000),
 status text not null default 'pending' check(status in ('pending','approved','spam','rejected')),
 created_at timestamptz not null default now(),
 foreign key(post_id,site_id) references public.builder_blog_posts(id,site_id) on delete cascade
);
create index builder_blog_comments_post_idx on public.builder_blog_comments(post_id,status,created_at);
alter table public.builder_blog_categories enable row level security;
alter table public.builder_blog_posts enable row level security;
alter table public.builder_blog_comments enable row level security;
create policy builder_blog_categories_public_select on public.builder_blog_categories for select to anon
using(exists(select 1 from public.builder_blog_posts p where p.site_id=builder_blog_categories.site_id and p.category_id=builder_blog_categories.id and p.status='published'));
create policy builder_blog_categories_member_select on public.builder_blog_categories for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_categories.site_id and m.user_id=(select auth.uid())));
create policy builder_blog_categories_insert on public.builder_blog_categories for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_blog_categories_update on public.builder_blog_categories for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_blog_categories_delete on public.builder_blog_categories for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_blog_posts_public_select on public.builder_blog_posts for select to anon
using(status='published' and published_at is not null and published_at<=now());
create policy builder_blog_posts_member_select on public.builder_blog_posts for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_posts.site_id and m.user_id=(select auth.uid())));
create policy builder_blog_posts_insert on public.builder_blog_posts for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_posts.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_blog_posts_update on public.builder_blog_posts for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_posts.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_posts.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_blog_posts_delete on public.builder_blog_posts for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_posts.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_blog_comments_public_approved on public.builder_blog_comments for select to anon
using(status='approved' and exists(select 1 from public.builder_blog_posts p where p.id=builder_blog_comments.post_id and p.status='published' and p.allow_comments));
create policy builder_blog_comments_member_select on public.builder_blog_comments for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_comments.site_id and m.user_id=(select auth.uid())));
create policy builder_blog_comments_member_update on public.builder_blog_comments for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_comments.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_blog_comments.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
revoke all on public.builder_blog_categories,public.builder_blog_posts,public.builder_blog_comments from anon,authenticated;
grant select on public.builder_blog_categories,public.builder_blog_posts,public.builder_blog_comments to anon;
grant select,insert,update,delete on public.builder_blog_categories,public.builder_blog_posts to authenticated;
grant select,update on public.builder_blog_comments to authenticated;
grant all on public.builder_blog_categories,public.builder_blog_posts,public.builder_blog_comments to service_role;
