drop policy builder_categories_select on public.builder_product_categories;
create policy builder_categories_public_select on public.builder_product_categories for select to anon
using(is_active and exists(select 1 from public.builder_store_settings st where st.site_id=builder_product_categories.site_id and st.enabled));
create policy builder_categories_member_select on public.builder_product_categories for select to authenticated
using((is_active and exists(select 1 from public.builder_store_settings st where st.site_id=builder_product_categories.site_id and st.enabled))
 or exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_categories.site_id and m.user_id=(select auth.uid())));

drop policy builder_products_select on public.builder_products;
create policy builder_products_public_select on public.builder_products for select to anon
using(status='active' and exists(select 1 from public.builder_store_settings st where st.site_id=builder_products.site_id and st.enabled));
create policy builder_products_member_select on public.builder_products for select to authenticated
using((status='active' and exists(select 1 from public.builder_store_settings st where st.site_id=builder_products.site_id and st.enabled))
 or exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_products.site_id and m.user_id=(select auth.uid())));

drop policy builder_variants_select on public.builder_product_variants;
create policy builder_variants_public_select on public.builder_product_variants for select to anon
using(is_active and exists(select 1 from public.builder_products p join public.builder_store_settings st on st.site_id=p.site_id where p.id=builder_product_variants.product_id and p.status='active' and st.enabled));
create policy builder_variants_member_select on public.builder_product_variants for select to authenticated
using((is_active and exists(select 1 from public.builder_products p join public.builder_store_settings st on st.site_id=p.site_id where p.id=builder_product_variants.product_id and p.status='active' and st.enabled))
 or exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=builder_product_variants.site_id and m.user_id=(select auth.uid())));
