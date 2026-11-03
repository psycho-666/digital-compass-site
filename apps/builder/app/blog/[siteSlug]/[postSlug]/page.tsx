import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import "../public-blog.css";
type Props={params:Promise<{siteSlug:string;postSlug:string}>};
export default async function PublicBlogPost({params}:Props){
 const {siteSlug,postSlug}=await params,db=await createClient();
 const {data:site}=await db.from("builder_sites").select("id,name,slug,default_locale").eq("slug",siteSlug).maybeSingle();if(!site)notFound();
 const {data:post}=await db.from("builder_blog_posts").select("id,title,slug,excerpt,content,author_name,published_at,allow_comments").eq("site_id",site.id).eq("slug",postSlug).eq("status","published").maybeSingle();if(!post)notFound();
 const ar=site.default_locale!=="en";
 const {data:comments}=post.allow_comments?await db.from("builder_blog_comments").select("id,author_name,body,created_at").eq("post_id",post.id).eq("status","approved").order("created_at",{ascending:true}):{data:[]};
 return <main className="public-blog" dir={ar?"rtl":"ltr"}><header className="public-blog-top"><Link href={"/blog/"+siteSlug}>◈ {site.name}</Link><Link href={"/blog/"+siteSlug}>{ar?"كل المقالات":"All posts"}</Link></header><article className="public-post-detail"><p>{post.published_at?new Date(post.published_at).toLocaleDateString(ar?"ar-IQ":"en-US"):""} · {post.author_name}</p><h1>{post.title}</h1>{post.excerpt?<h2>{post.excerpt}</h2>:null}<div className="public-post-content">{post.content}</div></article>{post.allow_comments?<section className="public-comments"><h2>{ar?"التعليقات":"Comments"}</h2>{comments?.length?comments.map(c=><article key={c.id}><strong>{c.author_name}</strong><small>{new Date(c.created_at).toLocaleDateString(ar?"ar-IQ":"en-US")}</small><p>{c.body}</p></article>):<p>{ar?"لا توجد تعليقات معتمدة بعد.":"No approved comments yet."}</p>}</section>:null}<footer className="public-blog-footer">{site.name}</footer></main>;
}
