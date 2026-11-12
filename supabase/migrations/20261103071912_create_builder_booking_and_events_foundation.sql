create table public.builder_booking_services(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 160),description text not null default '',
 duration_minutes smallint not null default 60 check(duration_minutes between 5 and 1440),
 price numeric(14,2) not null default 0 check(price>=0),currency text not null default 'IQD' check(currency ~ '^[A-Z]{3}$'),
 is_active boolean not null default true,sort_order integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,site_id)
);
create table public.builder_booking_availability(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,
 service_id uuid,weekday smallint not null check(weekday between 0 and 6),start_time time not null,end_time time not null,
 slot_minutes smallint not null default 60 check(slot_minutes between 5 and 1440),capacity smallint not null default 1 check(capacity between 1 and 100),
 is_active boolean not null default true,created_at timestamptz not null default now(),check(end_time>start_time),
 foreign key(service_id,site_id) references public.builder_booking_services(id,site_id) on delete cascade
);
create table public.builder_bookings(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,
 service_id uuid,customer_name text not null check(char_length(customer_name) between 1 and 160),
 customer_email text not null default '' check(char_length(customer_email)<=254),customer_phone text not null default '' check(char_length(customer_phone)<=40),
 starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'pending' check(status in ('pending','confirmed','cancelled','completed','no_show')),
 party_size smallint not null default 1 check(party_size between 1 and 100),customer_note text not null default '',internal_note text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(ends_at>starts_at),
 foreign key(service_id,site_id) references public.builder_booking_services(id,site_id) on delete set null(service_id)
);
create index builder_bookings_site_start_idx on public.builder_bookings(site_id,starts_at,status);
create index builder_booking_availability_service_idx on public.builder_booking_availability(service_id,site_id,weekday);
create table public.builder_events(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 200),slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,100}$'),
 description text not null default '',venue text not null default '',starts_at timestamptz not null,ends_at timestamptz not null,
 capacity integer check(capacity is null or capacity>0),price numeric(14,2) not null default 0 check(price>=0),
 currency text not null default 'IQD' check(currency ~ '^[A-Z]{3}$'),status text not null default 'draft' check(status in ('draft','published','cancelled','completed')),
 registration_enabled boolean not null default true,cover_image_path text,seo_title text not null default '',seo_description text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(site_id,slug),unique(id,site_id),check(ends_at>starts_at)
);
create index builder_events_public_idx on public.builder_events(site_id,status,starts_at);
create table public.builder_event_registrations(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id) on delete cascade,event_id uuid not null,
 attendee_name text not null check(char_length(attendee_name) between 1 and 160),attendee_email text not null default '' check(char_length(attendee_email)<=254),
 attendee_phone text not null default '' check(char_length(attendee_phone)<=40),quantity smallint not null default 1 check(quantity between 1 and 100),
 total numeric(14,2) not null default 0 check(total>=0),status text not null default 'pending' check(status in ('pending','confirmed','cancelled','refunded')),
 attendee_note text not null default '',created_at timestamptz not null default now(),
 foreign key(event_id,site_id) references public.builder_events(id,site_id) on delete cascade
);
create index builder_event_registrations_event_idx on public.builder_event_registrations(event_id,status,created_at);
alter table public.builder_booking_services enable row level security;
alter table public.builder_booking_availability enable row level security;
alter table public.builder_bookings enable row level security;
alter table public.builder_events enable row level security;
alter table public.builder_event_registrations enable row level security;
create policy builder_booking_services_public_select on public.builder_booking_services for select to anon
using(is_active and exists(select 1 from public.builder_sites s where s.id=builder_booking_services.site_id));
create policy builder_booking_services_member_select on public.builder_booking_services for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_services.site_id and m.user_id=(select auth.uid())));
create policy builder_booking_services_member_insert on public.builder_booking_services for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_services.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_booking_services_member_update on public.builder_booking_services for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_services.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_services.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_booking_services_member_delete on public.builder_booking_services for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_services.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_booking_availability_public_select on public.builder_booking_availability for select to anon
using(is_active and exists(select 1 from public.builder_booking_services b where b.id=builder_booking_availability.service_id and b.is_active));
create policy builder_booking_availability_member_select on public.builder_booking_availability for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_availability.site_id and m.user_id=(select auth.uid())));
create policy builder_booking_availability_member_insert on public.builder_booking_availability for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_availability.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_booking_availability_member_update on public.builder_booking_availability for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_availability.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_availability.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_booking_availability_member_delete on public.builder_booking_availability for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_booking_availability.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_bookings_member_select on public.builder_bookings for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_bookings.site_id and m.user_id=(select auth.uid())));
create policy builder_bookings_member_update on public.builder_bookings for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_bookings.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_bookings.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_events_public_select on public.builder_events for select to anon using(status='published' and ends_at>=now());
create policy builder_events_member_select on public.builder_events for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_events.site_id and m.user_id=(select auth.uid())));
create policy builder_events_member_insert on public.builder_events for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_events.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_events_member_update on public.builder_events for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_events.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_events.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_events_member_delete on public.builder_events for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_events.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_event_registrations_member_select on public.builder_event_registrations for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_event_registrations.site_id and m.user_id=(select auth.uid())));
create policy builder_event_registrations_member_update on public.builder_event_registrations for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_event_registrations.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_event_registrations.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
revoke all on public.builder_booking_services,public.builder_booking_availability,public.builder_bookings,public.builder_events,public.builder_event_registrations from anon,authenticated;
grant select on public.builder_booking_services,public.builder_booking_availability,public.builder_events to anon;
grant select,insert,update,delete on public.builder_booking_services,public.builder_booking_availability,public.builder_events to authenticated;
grant select,update on public.builder_bookings,public.builder_event_registrations to authenticated;
grant all on public.builder_booking_services,public.builder_booking_availability,public.builder_bookings,public.builder_events,public.builder_event_registrations to service_role;
