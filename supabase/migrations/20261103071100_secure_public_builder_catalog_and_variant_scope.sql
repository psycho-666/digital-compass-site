-- Public catalog RLS evaluates store enablement as the requesting role.
-- Expose only non-secret storefront settings and only while the store is enabled.
create policy builder_store_settings_public_enabled_read on public.builder_store_settings
for select to anon using(enabled);
grant select on public.builder_store_settings to anon;

-- Keep variant relationships tenant-scoped for stock movements and order snapshots.
alter table public.builder_product_variants add constraint builder_product_variants_id_site_id_key unique(id,site_id);
alter table public.builder_inventory_movements drop constraint builder_inventory_movements_variant_id_fkey;
alter table public.builder_inventory_movements add constraint builder_inventory_variant_same_site_fk
 foreign key(variant_id,site_id) references public.builder_product_variants(id,site_id) on delete set null(variant_id);
alter table public.builder_order_items drop constraint builder_order_items_variant_id_fkey;
alter table public.builder_order_items add constraint builder_order_item_variant_same_site_fk
 foreign key(variant_id,site_id) references public.builder_product_variants(id,site_id) on delete set null(variant_id);

-- Remove duplicate order-item -> order FK (the inline FK already enforces this relation).
alter table public.builder_order_items drop constraint if exists builder_order_items_order_id_fkey1;
