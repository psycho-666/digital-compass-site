import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {validateBuilderDocument} from "@/lib/builder/schema";
import "./published.css";

export const dynamic="force-dynamic";

export default async function PublishedPage({params}:{params:Promise<{siteSlug:string;locale:string;pageSlug:string}>}){
 const {siteSlug,locale,pageSlug}=await params;
 if(locale!=="ar"&&locale!=="en")notFound();
 const supabase=await createClient();
 const {data:site,error:siteError}=await supabase.from("builder_sites").select("id,name,default_locale").eq("slug",siteSlug).maybeSingle();
 if(siteError||!site)notFound();
 const {data:page,error:pageError}=await supabase.from("builder_pages").select("id,title,locale").eq("site_id",site.id).eq("slug",pageSlug).eq("locale",locale).maybeSingle();
 if(pageError||!page)notFound();
 const {data:version,error:versionError}=await supabase.from("builder_page_versions").select("document,version_no").eq("page_id",page.id).eq("status","published").order("version_no",{ascending:false}).limit(1).maybeSingle();
 if(versionError||!version||!validateBuilderDocument(version.document))notFound();
 const imageUrls:Record<string,string>={};
 await Promise.all(version.document.blocks.filter(block=>block.props.imagePath).map(async block=>{
  const path=block.props.imagePath!;
  const {data}=await supabase.storage.from("builder-media").createSignedUrl(path,3600);
  if(data?.signedUrl)imageUrls[path]=data.signedUrl;
 }));
 const ar=locale==="ar";
 return <main className="published-site" dir={ar?"rtl":"ltr"} lang={locale}>
  <header className="published-header"><a href={"/sites/"+siteSlug+"/"+locale+"/home"}>{site.name}</a><nav><a href={"/sites/"+siteSlug+"/"+locale+"/home"}>{ar?"الرئيسية":"Home"}</a></nav></header>
  {version.document.blocks.map(block=><section className={"published-block published-"+block.type} key={block.id}>
   <h1>{block.props.title}</h1><p>{block.props.body}</p>
   {block.props.imagePath&&imageUrls[block.props.imagePath]&&<img src={imageUrls[block.props.imagePath]} alt={block.props.title}/>}
   {block.type==="hero"&&<a className="published-cta" href="#contact">{ar?"تواصل معنا":"Get in touch"}</a>}
  </section>)}
  <footer id="contact" className="published-footer">© {new Date().getFullYear()} {site.name}</footer>
 </main>;
}
