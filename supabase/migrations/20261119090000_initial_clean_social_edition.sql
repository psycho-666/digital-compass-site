-- Digital Compass Social Edition: clean baseline
-- Applied to Supabase project xnoalyxxrjyovivdeojo on 2026-11-19.
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, display_name text, role text not null default 'staff' check(role in ('owner','admin','staff')),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.clients (
 id uuid primary key default gen_random_uuid(), business_name text not null, industry text, country text default 'Iraq',
 city text, contact_name text, phone text, email text, status text not null default 'active' check(status in ('prospect','active','paused','closed')),
 monthly_fee numeric(12,2) not null default 0, currency text not null default 'USD', notes text,
 created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.leads (
 id uuid primary key default gen_random_uuid(), business_name text not null, industry text, country text default 'Iraq', city text,
 facebook_url text, instagram_url text, website_url text, contact_name text, phone text, email text, source text,
 stage text not null default 'new' check(stage in ('new','discovered','audited','qualified','contacted','interested','negotiation','converted','rejected','follow_up')),
 audit_score smallint check(audit_score between 0 and 100), estimated_value numeric(12,2), currency text not null default 'USD',
 next_followup_at timestamptz, notes text, assigned_to uuid references public.profiles(id) on delete set null,
 converted_client_id uuid references public.clients(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.social_accounts (
 id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id) on delete cascade,
 platform text not null check(platform in ('facebook','instagram','tiktok','linkedin','youtube','x')),
 external_account_id text, account_name text not null, profile_url text,
 account_type text not null default 'client' check(account_type in ('owned_page','client')),
 connection_status text not null default 'disconnected' check(connection_status in ('connected','needs_reconnect','disconnected','error')),
 token_secret_ref uuid, granted_scopes jsonb not null default '[]', last_synced_at timestamptz, metadata jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index social_accounts_platform_external_id_uq on public.social_accounts(platform,external_account_id) where external_account_id is not null;
create table public.inbox_threads (
 id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id) on delete set null,
 social_account_id uuid references public.social_accounts(id) on delete set null, platform text not null,
 external_thread_id text, participant_name text, participant_external_id text,
 status text not null default 'open' check(status in ('open','pending','resolved','archived')),
 assigned_to uuid references public.profiles(id) on delete set null, last_activity_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.inbox_items (
 id uuid primary key default gen_random_uuid(), thread_id uuid references public.inbox_threads(id) on delete cascade,
 client_id uuid references public.clients(id) on delete set null, social_account_id uuid references public.social_accounts(id) on delete set null,
 platform text not null, item_type text not null check(item_type in ('message','comment')), external_item_id text,
 external_parent_id text, external_post_id text, sender_name text, sender_external_id text, body text not null,
 direction text not null default 'inbound' check(direction in ('inbound','outbound')),
 status text not null default 'unread' check(status in ('unread','read','resolved','failed')),
 reply_status text not null default 'not_replied' check(reply_status in ('not_replied','drafted','sent','failed')),
 received_at timestamptz not null default now(), payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create unique index inbox_items_platform_external_id_uq on public.inbox_items(platform,external_item_id) where external_item_id is not null;
create table public.content_posts (
 id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id) on delete cascade,
 social_account_id uuid references public.social_accounts(id) on delete set null, platform text, title text,
 caption text not null default '', media_urls jsonb not null default '[]',
 status text not null default 'draft' check(status in ('draft','pending_approval','approved','scheduled','published','failed')),
 scheduled_at timestamptz, published_at timestamptz, external_post_id text,
 created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.services (
 id uuid primary key default gen_random_uuid(), name text not null unique, description text, price numeric(12,2) not null default 0,
 currency text not null default 'USD', billing_period text not null default 'one_time' check(billing_period in ('one_time','monthly','yearly')),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.client_services (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
 service_id uuid not null references public.services(id) on delete restrict, agreed_price numeric(12,2) not null,
 currency text not null, starts_at date, renews_at date,
 status text not null default 'active' check(status in ('active','paused','cancelled','completed')), created_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
 amount numeric(12,2) not null, currency text not null default 'USD', payment_date date not null default current_date,
 payment_method text, reference text, notes text, created_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id) on delete cascade,
 lead_id uuid references public.leads(id) on delete cascade, title text not null, description text, due_at timestamptz,
 status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 assigned_to uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.client_knowledge (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
 category text not null, title text not null, content text not null, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.client_faqs (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete cascade,
 question text not null, approved_answer text not null, keywords jsonb not null default '[]',
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.platform_integrations (
 id uuid primary key default gen_random_uuid(), platform text not null unique, app_id text, api_version text, api_base_url text,
 required_scopes jsonb not null default '[]', webhook_fields jsonb not null default '[]',
 status text not null default 'not_configured' check(status in ('not_configured','needs_credentials','ready','error')),
 last_verified_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.webhook_events (
 id uuid primary key default gen_random_uuid(), platform text not null, event_type text not null, external_event_id text,
 account_external_id text, received_at timestamptz not null default now(), processed_at timestamptz,
 status text not null default 'received' check(status in ('received','processed','ignored','failed')),
 error_message text, payload jsonb not null default '{}'
);
create unique index webhook_events_platform_external_id_uq on public.webhook_events(platform,external_event_id) where external_event_id is not null;
create table public.automation_rules (
 id uuid primary key default gen_random_uuid(), name text not null, trigger_type text not null,
 conditions jsonb not null default '{}', actions jsonb not null default '[]', is_enabled boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.automation_runs (
 id uuid primary key default gen_random_uuid(), rule_id uuid references public.automation_rules(id) on delete set null,
 status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
 input jsonb not null default '{}', output jsonb not null default '{}', error_message text,
 started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.activity_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
 action text not null, entity_type text, entity_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.is_social_staff() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true); $$;
create or replace function public.is_social_owner() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and p.role in ('owner','admin')); $$;
create or replace function public.handle_social_user_created() returns trigger language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,email,display_name,role) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),'staff')
 on conflict(id) do update set email=excluded.email;
 return new;
end; $$;
create trigger on_social_auth_user_created after insert on auth.users for each row execute procedure public.handle_social_user_created();

insert into public.profiles(id,email,display_name,role,is_active)
select au.id,au.email,coalesce(au.raw_user_meta_data->>'full_name',au.raw_user_meta_data->>'name',au.email),
 case when lower(coalesce(au.role,'')) in ('owner','admin') then lower(au.role)
 when lower(coalesce(au.role,'')) in ('service_role','supabase_admin') then 'owner' else 'staff' end,true
from auth.users au on conflict(id) do update set email=excluded.email;
insert into public.profiles(id,email,display_name,role,is_active)
select a.user_id,a.email,coalesce(a.display_name,a.username,a.email),
 case when lower(coalesce(a.role,'')) in ('owner','admin') then lower(a.role) else 'staff' end,coalesce(a.is_active,true)
from public.admin_users a where a.user_id is not null
on conflict(id) do update set email=excluded.email,display_name=excluded.display_name,
 role=case when excluded.role in ('owner','admin') then excluded.role else public.profiles.role end,is_active=excluded.is_active;

alter table public.profiles enable row level security;
create policy profiles_read_self_or_admin on public.profiles for select using(id=auth.uid() or public.is_social_owner());
create policy profiles_update_self_or_admin on public.profiles for update using(id=auth.uid() or public.is_social_owner());
do $$
declare t text;
begin
 foreach t in array array['clients','leads','social_accounts','inbox_threads','inbox_items','content_posts','services','client_services','payments','tasks','client_knowledge','client_faqs','platform_integrations','webhook_events','automation_rules','automation_runs','activity_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy social_staff_access on public.%I for all using (public.is_social_staff()) with check (public.is_social_staff())',t);
 end loop;
end $$;

create index clients_status_idx on public.clients(status);
create index leads_stage_idx on public.leads(stage);
create index leads_followup_idx on public.leads(next_followup_at) where next_followup_at is not null;
create index tasks_due_idx on public.tasks(due_at) where status <> 'done';
create index content_posts_schedule_idx on public.content_posts(scheduled_at) where scheduled_at is not null;

insert into public.services(name,description,price,currency,billing_period) values
 ('Basic social media management','Monthly social media account management',50,'USD','monthly'),
 ('Pro social media management','Advanced monthly social media management',100,'USD','monthly'),
 ('Social media account audit','Social media presence audit',50000,'IQD','one_time'),
 ('Account setup and optimization','Social account setup and optimization',50000,'IQD','one_time'),
 ('Single post design','One social media post design',10000,'IQD','one_time'),
 ('10-design package','Package of ten social media designs',85000,'IQD','one_time');

insert into public.platform_integrations(platform,app_id,api_version,api_base_url,required_scopes,webhook_fields,status)
values('facebook','1460593969264285','v26.0','https://graph.facebook.com',
 '["pages_show_list","pages_read_engagement","pages_manage_posts","pages_manage_metadata","pages_messaging","pages_manage_engagement"]',
 '["messages","messaging_postbacks","feed","comments"]','needs_credentials');
insert into public.social_accounts(platform,external_account_id,account_name,profile_url,account_type,connection_status,granted_scopes,metadata)
values('facebook','948895458300409','078 للأرقام المميزة','https://www.facebook.com/948895458300409','owned_page','needs_reconnect',
 '["pages_show_list","pages_messaging","pages_read_engagement","pages_manage_metadata","pages_read_user_content","pages_manage_posts","pages_manage_engagement"]',
 '{"historical_reference":true,"access_token_removed":true,"requires_new_oauth":true}');
