-- Tighten nullable composite foreign keys and consolidate catalog SELECT policies.
alter table public.builder_product_categories drop constraint builder_category_parent_same_site_fk;
alter table public.builder_product_categories add constraint builder_category_parent_same_site_fk
 foreign key(parent_id,site_id) references public.builder_product_categories(id,site_id) on delete set null(parent_id);
alter table public.builder_products drop constraint builder_product_category_same_site_fk;
alter table public.builder_products add constraint builder_product_category_same_site_fk
 foreign key(category_id,site_id) references public.builder_product_categories(id,site_id) on delete set null(category_id);
alter table public.builder_order_items drop constraint builder_order_items_product_id_site_id_fkey;
alter table public.builder_order_items add constraint builder_order_items_product_id_site_id_fkey
 foreign key(product_id,site_id) references public.builder_products(id,site_id) on delete set null(product_id);

drop policy builder_categories_public_active_read on public.builder_product_categories;
drop policy builder_categories_member_manage on public.builder_product_categories;
create policy builder_categories_select on public.builder_product_categories for select to anon,authenticated
using((is_active and exists(select 1 from public.builder_store_settings st where st.site_id=builder_product_categories.site_id and st.enabled))
 or exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid())));
create policy builder_categories_insert on public.builder_product_categories for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_categories_update on public.builder_product_categories for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_categories_delete on public.builder_product_categories for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

drop policy builder_products_public_active_read on public.builder_products;
drop policy builder_products_member_manage on public.builder_products;
create policy builder_products_select on public.builder_products for select to anon,authenticated
using((status='active' and exists(select 1 from public.builder_store_settings st where st.site_id=builder_products.site_id and st.enabled))
 or exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid())));
create policy builder_products_insert on public.builder_products for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_products_update on public.builder_products for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_products_delete on public.builder_products for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

drop policy builder_variants_public_active_read on public.builder_product_variants;
drop policy builder_variants_member_manage on public.builder_product_variants;
create policy builder_variants_select on public.builder_product_variants for select to anon,authenticated
using((is_active and exists(select 1 from public.builder_products p join public.builder_store_settings st on st.site_id=p.site_id where p.id=builder_product_variants.product_id and p.status='active' and st.enabled))
 or exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid())));
create policy builder_variants_insert on public.builder_product_variants for insert to authenticated
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_variants_update on public.builder_product_variants for update to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')))
with check(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy builder_variants_delete on public.builder_product_variants for delete to authenticated
using(exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));

create index if not exists builder_categories_parent_idx on public.builder_product_categories(parent_id) where parent_id is not null;
create index if not exists builder_products_category_fk_idx on public.builder_products(category_id) where category_id is not null;
create index if not exists builder_variants_site_fk_idx on public.builder_product_variants(site_id);
create index if not exists builder_inventory_site_fk_idx on public.builder_inventory_movements(site_id);
create index if not exists builder_inventory_variant_fk_idx on public.builder_inventory_movements(variant_id) where variant_id is not null;
create index if not exists builder_shipping_rates_zone_fk_idx on public.builder_shipping_rates(zone_id);
create index if not exists builder_order_items_product_fk_idx on public.builder_order_items(product_id) where product_id is not null;
create index if not exists builder_order_items_variant_fk_idx on public.builder_order_items(variant_id) where variant_id is not null;
create index if not exists builder_order_items_site_fk_idx on public.builder_order_items(site_id);
