import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./shop.css";

type Props={params:Promise<{siteSlug:string;productSlug:string}>};
export default async function PublicProductPage({params}:Props){
 const {siteSlug,productSlug}=await params,db=await createClient();
 const {data:site}=await db.from("builder_sites").select("id,name,slug").eq("slug",siteSlug).maybeSingle();if(!site)notFound();
 const {data:settings}=await db.from("builder_store_settings").select("store_name,currency,locale,enabled").eq("site_id",site.id).maybeSingle();if(!settings?.enabled)notFound();
 const {data:product}=await db.from("builder_products").select("name,description,price,compare_at_price,sku,is_digital").eq("site_id",site.id).eq("slug",productSlug).eq("status","active").maybeSingle();if(!product)notFound();
 const ar=settings.locale==="ar",currency=settings.currency||"IQD",money=(value:number)=>new Intl.NumberFormat(ar?"ar-IQ":"en-US",{maximumFractionDigits:2}).format(Number(value||0))+" "+currency;
 return <main className="public-shop" dir={ar?"rtl":"ltr"}><header className="shop-header"><Link href={"/shop/"+siteSlug} className="shop-logo">◈ {settings.store_name||site.name}</Link><span>{ar?"تفاصيل المنتج":"PRODUCT DETAILS"}</span></header><nav className="shop-breadcrumb"><Link href={"/shop/"+siteSlug}>{ar?"المتجر":"Store"}</Link><span> / </span>{product.name}</nav><article className="shop-detail"><div className="shop-detail-art">◈</div><div className="shop-detail-copy"><p className="shop-kicker">{ar?"تفاصيل المنتج":"PRODUCT OVERVIEW"}</p><h1>{product.name}</h1><strong className="shop-detail-price">{money(product.price)}</strong>{product.compare_at_price&&product.compare_at_price>product.price?<del>{money(product.compare_at_price)}</del>:null}<p>{product.description|| (ar?"لا تتوفر تفاصيل إضافية لهذا المنتج.":"No additional details are available for this product.")}</p><small>{product.is_digital?(ar?"منتج رقمي":"Digital product"):(ar?"منتج مادي":"Physical product")}{product.sku?" · SKU: "+product.sku:""}</small><div className="shop-checkout-note">{ar?"الطلب والدفع الإلكتروني غير متاحين حالياً. تواصل مع المتجر لإتمام الشراء.":"Online ordering and payment are not available yet. Contact the store to complete your purchase."}</div><Link className="shop-return" href={"/shop/"+siteSlug}>{ar?"العودة إلى المتجر":"Back to store"}</Link></div></article><footer className="shop-footer">{settings.store_name||site.name}</footer></main>;
}
