import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./shop.css";

type Props={params:Promise<{siteSlug:string}>};
export default async function PublicStorePage({params}:Props){
 const {siteSlug}=await params,db=await createClient();
 const {data:site}=await db.from("builder_sites").select("id,name,slug,default_locale").eq("slug",siteSlug).maybeSingle();
 if(!site)notFound();
 const {data:settings}=await db.from("builder_store_settings").select("store_name,currency,locale,enabled").eq("site_id",site.id).maybeSingle();
 if(!settings?.enabled)notFound();
 const locale=settings.locale==="en"?"en":"ar",ar=locale==="ar";
 const [{data:products},{data:categories}]=await Promise.all([
  db.from("builder_products").select("id,name,slug,description,price,compare_at_price,category_id,sku,is_digital").eq("site_id",site.id).eq("status","active").order("created_at",{ascending:false}),
  db.from("builder_product_categories").select("id,name,slug").eq("site_id",site.id).eq("is_active",true).order("sort_order")
 ]);
 const currency=settings.currency||"IQD";
 const money=(value:number)=>new Intl.NumberFormat(ar?"ar-IQ":"en-US",{maximumFractionDigits:2}).format(Number(value||0))+" "+currency;
 return <main className="public-shop" dir={ar?"rtl":"ltr"}>
  <header className="shop-header"><Link href={"/shop/"+siteSlug} className="shop-logo">◈ {settings.store_name||site.name}</Link><span>{ar?"المتجر الإلكتروني":"ONLINE STORE"}</span></header>
  <section className="shop-hero"><p>{ar?"تسوّق بسهولة":"DISCOVER THE COLLECTION"}</p><h1>{ar?"منتجات مختارة لك":"Products made for you"}</h1><span>{ar?"تصفّح المنتجات المتوفرة وتعرّف على تفاصيلها.":"Explore the available products and learn more about each one."}</span></section>
  {categories?.length? <nav className="shop-categories"><Link href={"/shop/"+siteSlug}>{ar?"كل المنتجات":"All products"}</Link>{categories.map(c=><a key={c.id} href={"#category-"+c.id}>{c.name}</a>)}</nav>:null}
  {products?.length? <div className="shop-products">{categories?.length?categories.map(c=>{const items=products.filter(p=>p.category_id===c.id);return items.length?<section className="shop-category" id={"category-"+c.id} key={c.id}><h2>{c.name}</h2><div className="shop-grid">{items.map(p=><Link className="shop-card" href={"/shop/"+siteSlug+"/"+p.slug} key={p.id}><div className="shop-card-art">◈</div><div className="shop-card-body"><h3>{p.name}</h3><p>{p.description|| (ar?"اكتشف تفاصيل المنتج.":"Explore product details.")}</p><strong>{money(p.price)}</strong></div></Link>)}</div></section>:null}):<div className="shop-grid">{products.map(p=><Link className="shop-card" href={"/shop/"+siteSlug+"/"+p.slug} key={p.id}><div className="shop-card-art">◈</div><div className="shop-card-body"><h3>{p.name}</h3><p>{p.description|| (ar?"اكتشف تفاصيل المنتج.":"Explore product details.")}</p><strong>{money(p.price)}</strong></div></Link>)}</div>}</div>:<p className="shop-empty">{ar?"لا توجد منتجات منشورة حالياً.":"There are no published products yet."}</p>}
  <footer className="shop-footer">{settings.store_name||site.name} · {ar?"جميع الحقوق محفوظة":"All rights reserved"}</footer>
 </main>;
}
