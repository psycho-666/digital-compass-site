import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import "./public-blog.css";
type Props={params:Promise<{siteSlug:string}>};
export default async function PublicBlog({params}:Props){
 const {siteSlug}=await params,db=await createClient();
 const {data:site}=await db.from("builder_sites").select("id,name,slug,default_locale").eq("slug",siteSlug).maybeSingle();if(!site)notFound();
 const {data:posts}=await db.from("builder_blog_posts").select("id,title,slug,excerpt,author_name,published_at,category_id").eq("site_id",site.id).eq("status","published").order("published_at",{ascending:false});
 const {data:categories}=await db.from("builder_blog_categories").select("id,name,slug").eq("site_id",site.id).order("name");
 const ar=site.default_locale!=="en";
 return <main className="public-blog" dir={ar?"rtl":"ltr"}><header className="public-blog-top"><Link href={"/blog/"+siteSlug}>◈ {site.name}</Link><span>BLOG</span></header><section className="public-blog-hero"><p>{ar?"أفكار ومعرفة":"IDEAS & INSIGHTS"}</p><h1>{ar?"المدونة":"The Journal"}</h1><span>{ar?"مقالات وأخبار ونصائح من فريقنا.":"Stories, updates and practical insights from our team."}</span></section>{categories?.length?<nav className="public-blog-cats">{categories.map(c=><a key={c.id} href={"#cat-"+c.id}>{c.name}</a>)}</nav>:null}{posts?.length?<div className="public-blog-list">{categories?.length?categories.map(c=>{const rows=posts.filter(p=>p.category_id===c.id);return rows.length?<section id={"cat-"+c.id} key={c.id}><h2>{c.name}</h2><div className="public-blog-grid">{rows.map(p=><Link className="public-post-card" href={"/blog/"+siteSlug+"/"+p.slug} key={p.id}><span>{p.published_at?new Date(p.published_at).toLocaleDateString(ar?"ar-IQ":"en-US"):""}</span><h3>{p.title}</h3><p>{p.excerpt}</p><small>{p.author_name}</small></Link>)}</div></section>:null}):<div className="public-blog-grid">{posts.map(p=><Link className="public-post-card" href={"/blog/"+siteSlug+"/"+p.slug} key={p.id}><span>{p.published_at?new Date(p.published_at).toLocaleDateString(ar?"ar-IQ":"en-US"):""}</span><h3>{p.title}</h3><p>{p.excerpt}</p><small>{p.author_name}</small></Link>)}</div>}</div>:<p className="public-blog-empty">{ar?"لا توجد مقالات منشورة حالياً.":"No published articles yet."}</p>}<footer className="public-blog-footer">{site.name}</footer></main>;
}
