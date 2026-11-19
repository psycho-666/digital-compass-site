create table if not exists public.prospects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 business_name text not null, industry text, location text,
 platform text not null default 'other' check (platform in ('facebook','instagram','tiktok','linkedin','youtube','x','other')),
 account_url text, handle text, bio text, website_url text, contact_info text,
 followers_count bigint, posts_per_month numeric(8,2), engagement_rate numeric(8,3), last_post_at timestamptz,
 health_score numeric(5,2) check (health_score between 0 and 100),
 development_need_score numeric(5,2) check (development_need_score between 0 and 100),
 qualification_score numeric(5,2) check (qualification_score between 0 and 100),
 recommended_services text[] not null default '{}', weaknesses text[] not null default '{}', opportunities text[] not null default '{}',
 notes text, next_action text,
 status text not null default 'new' check (status in ('new','reviewing','qualified','contacted','meeting','client','not_fit','archived')),
 source text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists prospects_user_status_idx on public.prospects(user_id,status,created_at desc);
create index if not exists prospects_user_score_idx on public.prospects(user_id,qualification_score desc nulls last);
alter table public.prospects enable row level security;
drop policy if exists "Users manage own prospects" on public.prospects;
create policy "Users manage own prospects" on public.prospects for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.prospects to authenticated;

create table if not exists public.social_audits (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 prospect_id uuid not null references public.prospects(id) on delete cascade,
 audit_type text not null default 'manual' check (audit_type in ('manual','connected_account','ai_assisted')),
 health_score numeric(5,2) check (health_score between 0 and 100),
 development_need_score numeric(5,2) check (development_need_score between 0 and 100),
 qualification_score numeric(5,2) check (qualification_score between 0 and 100),
 criteria jsonb not null default '{}'::jsonb, strengths text[] not null default '{}', weaknesses text[] not null default '{}',
 recommendations text[] not null default '{}', summary text, created_at timestamptz not null default now()
);
create index if not exists social_audits_prospect_idx on public.social_audits(user_id,prospect_id,created_at desc);
alter table public.social_audits enable row level security;
drop policy if exists "Users manage own social audits" on public.social_audits;
create policy "Users manage own social audits" on public.social_audits for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.social_audits to authenticated;

create table if not exists public.prospect_activities (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 prospect_id uuid not null references public.prospects(id) on delete cascade,
 activity_type text not null default 'note', details text not null, created_at timestamptz not null default now()
);
create index if not exists prospect_activities_prospect_idx on public.prospect_activities(user_id,prospect_id,created_at desc);
alter table public.prospect_activities enable row level security;
drop policy if exists "Users manage own prospect activities" on public.prospect_activities;
create policy "Users manage own prospect activities" on public.prospect_activities for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.prospect_activities to authenticated;
update storage.buckets set file_size_limit=524288000 where id='social-media';