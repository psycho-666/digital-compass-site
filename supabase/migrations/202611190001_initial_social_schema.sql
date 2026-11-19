-- Digital Compass Social Edition: initial owner-scoped schema
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text, locale text not null default 'ar' check (locale in ('ar','en')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.connected_pages (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, platform text not null default 'facebook' check (platform in ('facebook','instagram')), external_page_id text not null, page_name text not null, page_picture_url text, is_active boolean not null default true, last_synced_at timestamptz, created_at timestamptz not null default now(), unique(user_id, platform, external_page_id));
create table private.page_credentials (page_id uuid primary key references public.connected_pages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, access_token text not null, token_expires_at timestamptz, updated_at timestamptz not null default now());
create table public.conversations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, page_id uuid not null references public.connected_pages(id) on delete cascade, platform_conversation_id text not null, participant_name text, participant_picture_url text, last_message text, last_message_at timestamptz, unread_count integer not null default 0 check (unread_count >= 0), status text not null default 'open' check (status in ('open','pending','closed')), created_at timestamptz not null default now(), unique(page_id, platform_conversation_id));
create table public.messages (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, conversation_id uuid not null references public.conversations(id) on delete cascade, external_message_id text, direction text not null check (direction in ('inbound','outbound')), body text not null default '', sent_at timestamptz not null default now(), delivery_status text not null default 'received' check (delivery_status in ('received','queued','sent','failed')));
create table public.comments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, page_id uuid not null references public.connected_pages(id) on delete cascade, external_comment_id text not null, post_external_id text, author_name text, body text not null, commented_at timestamptz not null default now(), reply_text text, replied_at timestamptz, status text not null default 'unanswered' check (status in ('unanswered','replied','hidden')), unique(page_id, external_comment_id));
create table public.scheduled_posts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, page_id uuid not null references public.connected_pages(id) on delete cascade, caption text not null default '', media_urls text[] not null default '{}', scheduled_for timestamptz, published_at timestamptz, status text not null default 'draft' check (status in ('draft','scheduled','publishing','published','failed')), platform_post_id text, created_at timestamptz not null default now());
create table public.automation_rules (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, page_id uuid references public.connected_pages(id) on delete cascade, name text not null, trigger_type text not null check (trigger_type in ('comment_keyword','incoming_message','mention')), trigger_value text, reply_text text not null, is_enabled boolean not null default false, created_at timestamptz not null default now());
create table public.activity_logs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, event_type text not null, description text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create index conversations_user_last_message_idx on public.conversations(user_id, last_message_at desc);
create index messages_conversation_sent_idx on public.messages(conversation_id, sent_at);
create index comments_user_commented_idx on public.comments(user_id, commented_at desc);
create index scheduled_posts_user_schedule_idx on public.scheduled_posts(user_id, scheduled_for);
create index activity_logs_user_created_idx on public.activity_logs(user_id, created_at desc);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
create policy profiles_owner_access on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
do $$
declare t text;
begin
  foreach t in array array['connected_pages','conversations','messages','comments','scheduled_posts','automation_rules','activity_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_owner_access', t);
  end loop;
end $$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
-- Composite ownership constraints prevent cross-user foreign-key references.
alter table public.connected_pages add constraint connected_pages_id_user_unique unique (id,user_id);
alter table public.conversations add constraint conversations_id_user_unique unique (id,user_id);
alter table public.conversations add constraint conversations_page_owner_fk foreign key (page_id,user_id) references public.connected_pages(id,user_id) on delete cascade;
alter table public.messages add constraint messages_conversation_owner_fk foreign key (conversation_id,user_id) references public.conversations(id,user_id) on delete cascade;
alter table public.comments add constraint comments_page_owner_fk foreign key (page_id,user_id) references public.connected_pages(id,user_id) on delete cascade;
alter table public.scheduled_posts add constraint scheduled_posts_page_owner_fk foreign key (page_id,user_id) references public.connected_pages(id,user_id) on delete cascade;
alter table public.automation_rules add constraint automation_rules_page_owner_fk foreign key (page_id,user_id) references public.connected_pages(id,user_id) on delete cascade;
