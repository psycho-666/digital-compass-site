-- Ecommerce foundation for the independent Website Builder edition.
-- Customer/order data is private. Public reads are limited to active catalog records
-- belonging to an explicitly enabled store.
create table public.builder_store_settings (
 site_id uuid primary key references public.builder_sites(id) on delete cascade,
 enabled boolean not null default false,
 store_name text not null default 'Online store' check(char_length(store_name) between 1 and 120),
 currency text not null default 'IQD' check(currency ~ '^[A-Z]{3}$'),
 locale text not null default 'ar' check(locale in ('ar','en')),
 checkout_mode text not null default 'manual' check(checkout_mode in ('manual','online')),
 tax_included boolean not null default false, terms_text text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.builder_product_categories (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 parent_id uuid, name text not null check(char_length(name) between 1 and 120),
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,80}$'), description text not null default '',
 sort_order integer not null default 0, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(site_id,slug), unique(id,site_id),
 constraint builder_category_parent_same_site_fk foreign key(parent_id,site_id)
 references public.builder_product_categories(id,site_id) on delete set null
);
create table public.builder_products (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 category_id uuid, name text not null check(char_length(name) between 1 and 180),
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,100}$'), description text not null default '',
 status text not null default 'draft' check(status in ('draft','active','archived')),
 price numeric(14,2) not null default 0 check(price>=0),
 compare_at_price numeric(14,2) check(compare_at_price is null or compare_at_price>=price),
 sku text, track_inventory boolean not null default false, inventory_quantity integer not null default 0 check(inventory_quantity>=0),
 allow_backorder boolean not null default false, is_digital boolean not null default false,
 weight_grams integer check(weight_grams is null or weight_grams>=0), images text[] not null default '{}',
 seo_title text not null default '', seo_description text not null default '', published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(site_id,slug), unique(id,site_id),
 constraint builder_product_category_same_site_fk foreign key(category_id,site_id)
 references public.builder_product_categories(id,site_id) on delete set null
);
create unique index builder_products_site_sku_unique on public.builder_products(site_id,sku) where sku is not null and sku<>'';
create index builder_products_catalog_idx on public.builder_products(site_id,status,created_at desc);
create index builder_products_category_idx on public.builder_products(category_id) where category_id is not null;
create table public.builder_product_variants (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 product_id uuid not null, name text not null check(char_length(name) between 1 and 160), sku text,
 options jsonb not null default '{}'::jsonb check(jsonb_typeof(options)='object'),
 price numeric(14,2) check(price is null or price>=0), inventory_quantity integer not null default 0 check(inventory_quantity>=0),
 is_active boolean not null default true, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(product_id,site_id) references public.builder_products(id,site_id) on delete cascade
);
create unique index builder_product_variants_sku_unique on public.builder_product_variants(site_id,sku) where sku is not null and sku<>'';
create index builder_product_variants_product_idx on public.builder_product_variants(product_id,sort_order);
create table public.builder_inventory_movements (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 product_id uuid not null, variant_id uuid, quantity_delta integer not null check(quantity_delta<>0),
 reason text not null check(reason in ('restock','sale','return','correction','reservation','release')),
 reference text not null default '', note text not null default '', created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 foreign key(product_id,site_id) references public.builder_products(id,site_id) on delete cascade,
 foreign key(variant_id) references public.builder_product_variants(id) on delete set null
);
create index builder_inventory_movements_product_idx on public.builder_inventory_movements(product_id,created_at desc);
create table public.builder_coupons (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 code text not null check(code ~ '^[A-Za-z0-9_-]{3,40}$'),
 discount_type text not null check(discount_type in ('percentage','fixed')),
 discount_value numeric(14,2) not null check(discount_value>0),
 minimum_subtotal numeric(14,2) not null default 0 check(minimum_subtotal>=0),
 usage_limit integer check(usage_limit is null or usage_limit>0), usage_count integer not null default 0 check(usage_count>=0),
 starts_at timestamptz, ends_at timestamptz, is_active boolean not null default true, created_at timestamptz not null default now(),
 unique(site_id,code), check(ends_at is null or starts_at is null or ends_at>starts_at),
 check(discount_type<>'percentage' or discount_value<=100)
);
create table public.builder_shipping_zones (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 120), countries text[] not null default '{}',
 regions text[] not null default '{}', is_active boolean not null default true, created_at timestamptz not null default now(),
 unique(id,site_id)
);
create table public.builder_shipping_rates (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 zone_id uuid not null, name text not null check(char_length(name) between 1 and 120),
 price numeric(14,2) not null default 0 check(price>=0), minimum_order numeric(14,2) not null default 0 check(minimum_order>=0),
 maximum_order numeric(14,2) check(maximum_order is null or maximum_order>=minimum_order),
 estimated_days_min smallint check(estimated_days_min is null or estimated_days_min>=0),
 estimated_days_max smallint check(estimated_days_max is null or estimated_days_max>=estimated_days_min),
 is_active boolean not null default true, created_at timestamptz not null default now(),
 foreign key(zone_id,site_id) references public.builder_shipping_zones(id,site_id) on delete cascade
);
create table public.builder_tax_rates (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 120), country_code text not null check(country_code ~ '^[A-Z]{2}$'),
 region text not null default '', rate numeric(7,4) not null check(rate>=0 and rate<=100),
 is_compound boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.builder_orders (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete restrict,
 order_number bigint generated by default as identity,
 status text not null default 'pending' check(status in ('pending','confirmed','processing','completed','cancelled','refunded')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending','paid','partially_refunded','refunded','failed')),
 fulfillment_status text not null default 'unfulfilled' check(fulfillment_status in ('unfulfilled','partial','fulfilled','returned')),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 subtotal numeric(14,2) not null check(subtotal>=0), discount_total numeric(14,2) not null default 0 check(discount_total>=0),
 tax_total numeric(14,2) not null default 0 check(tax_total>=0), shipping_total numeric(14,2) not null default 0 check(shipping_total>=0),
 total numeric(14,2) not null check(total>=0), coupon_code text,
 customer_name text not null check(char_length(customer_name) between 1 and 160),
 customer_email text not null default '' check(char_length(customer_email)<=254),
 customer_phone text not null default '' check(char_length(customer_phone)<=40),
 shipping_address jsonb not null default '{}'::jsonb check(jsonb_typeof(shipping_address)='object'),
 billing_address jsonb not null default '{}'::jsonb check(jsonb_typeof(billing_address)='object'),
 customer_note text not null default '', internal_note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(site_id,order_number)
);
create index builder_orders_site_created_idx on public.builder_orders(site_id,created_at desc);
create index builder_orders_site_status_idx on public.builder_orders(site_id,status,payment_status);
create table public.builder_order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.builder_orders(id) on delete cascade,
 site_id uuid not null references public.builder_sites(id) on delete cascade, product_id uuid, variant_id uuid,
 product_name text not null check(char_length(product_name) between 1 and 180), sku text not null default '',
 variant_name text not null default '', quantity integer not null check(quantity>0),
 unit_price numeric(14,2) not null check(unit_price>=0), line_total numeric(14,2) not null check(line_total>=0),
 product_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(product_snapshot)='object'), created_at timestamptz not null default now(),
 foreign key(product_id,site_id) references public.builder_products(id,site_id) on delete set null,
 foreign key(variant_id) references public.builder_product_variants(id) on delete set null
);
create index builder_order_items_order_idx on public.builder_order_items(order_id);
create or replace function public.builder_check_order_item_site()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.builder_orders o where o.id=new.order_id and o.site_id=new.site_id) then
  raise exception 'Order item site does not match its order';
 end if;
 return new;
end; $$;
revoke all on function public.builder_check_order_item_site() from public,anon,authenticated;
create trigger builder_order_item_site_guard before insert or update on public.builder_order_items
for each row execute function public.builder_check_order_item_site();

alter table public.builder_store_settings enable row level security;
alter table public.builder_product_categories enable row level security;
alter table public.builder_products enable row level security;
alter table public.builder_product_variants enable row level security;
alter table public.builder_inventory_movements enable row level security;
alter table public.builder_coupons enable row level security;
alter table public.builder_shipping_zones enable row level security;
alter table public.builder_shipping_rates enable row level security;
alter table public.builder_tax_rates enable row level security;
alter table public.builder_orders enable row level security;
alter table public.builder_order_items enable row level security;

create policy builder_store_settings_member_all on public.builder_store_settings for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_store_settings.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_store_settings.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create policy builder_categories_public_active_read on public.builder_product_categories for select to anon,authenticated
using(is_active and exists(select 1 from public.builder_store_settings st where st.site_id=builder_product_categories.site_id and st.enabled));
create policy builder_categories_member_manage on public.builder_product_categories for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create policy builder_products_public_active_read on public.builder_products for select to anon,authenticated
using(status='active' and exists(select 1 from public.builder_store_settings st where st.site_id=builder_products.site_id and st.enabled));
create policy builder_products_member_manage on public.builder_products for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create policy builder_variants_public_active_read on public.builder_product_variants for select to anon,authenticated
using(is_active and exists(select 1 from public.builder_products p join public.builder_store_settings st on st.site_id=p.site_id where p.id=builder_product_variants.product_id and p.status='active' and st.enabled));
create policy builder_variants_member_manage on public.builder_product_variants for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create policy builder_inventory_member_read on public.builder_inventory_movements for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_inventory_movements.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_inventory_member_insert on public.builder_inventory_movements for insert to authenticated
with check(created_by=(select auth.uid()) and exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_inventory_movements.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create policy builder_coupons_member_manage on public.builder_coupons for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_coupons.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_coupons.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_shipping_zones_member_manage on public.builder_shipping_zones for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_shipping_zones.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_shipping_zones.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_shipping_rates_member_manage on public.builder_shipping_rates for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_shipping_rates.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_shipping_rates.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_tax_rates_member_manage on public.builder_tax_rates for all to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_tax_rates.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_tax_rates.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create policy builder_orders_member_read on public.builder_orders for select to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_orders.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_orders_member_update on public.builder_orders for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_orders.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_orders.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_order_items_member_read on public.builder_order_items for select to authenticated
using(exists(select 1 from public.builder_orders o join public.builder_sites s on s.id=o.site_id join public.builder_workspace_members m on m.workspace_id=s.workspace_id where o.id=builder_order_items.order_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

grant select,insert,update,delete on public.builder_store_settings,public.builder_product_categories,public.builder_products,public.builder_product_variants,public.builder_coupons,public.builder_shipping_zones,public.builder_shipping_rates,public.builder_tax_rates to authenticated;
grant select,insert on public.builder_inventory_movements to authenticated;
grant select,update on public.builder_orders to authenticated;
grant select on public.builder_order_items to authenticated;
grant select on public.builder_product_categories,public.builder_products,public.builder_product_variants to anon;
grant all on public.builder_store_settings,public.builder_product_categories,public.builder_products,public.builder_product_variants,public.builder_inventory_movements,public.builder_coupons,public.builder_shipping_zones,public.builder_shipping_rates,public.builder_tax_rates,public.builder_orders,public.builder_order_items to service_role;
