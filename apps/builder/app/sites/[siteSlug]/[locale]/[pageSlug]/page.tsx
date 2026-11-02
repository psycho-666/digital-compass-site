import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {validateBuilderDocument,defaultBuilderTheme} from "@/lib/builder/schema";
import "./published.css";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{siteSlug:string;locale:string;pageSlug:string}>}){
 const {siteSlug,locale,pageSlug}=await params;
 if(locale!=="ar"&&locale!=="en")return {robots:{index:false,follow:false}};
 const supabase=await createClient();
 const {data:site}=await supabase.from("builder_sites").select("id,name").eq("slug",siteSlug).maybeSingle();
 if(!site)return {robots:{index:false,follow:false}};
 const {data:page}=await supabase.from("builder_pages").select("id").eq("site_id",site.id).eq("slug",pageSlug).eq("locale",locale).maybeSingle();
 if(!page)return {robots:{index:false,follow:false}};
 const {data:version}=await supabase.from("builder_page_versions").select("document").eq("page_id",page.id).eq("status","published").order("version_no",{ascending:false}).limit(1).maybeSingle();
 if(!version||!validateBuilderDocument(version.document))return {robots:{index:false,follow:false}};
 const description=version.document.blocks.find(block=>block.props.body)?.props.body.slice(0,160)||site.name;
 return {title:version.document.title,description,openGraph:{title:version.document.title,description,type:"website",locale:locale==="ar"?"ar_IQ":"en_US"}};
}

export default async function PublishedPage({params}:{params:Promise<{siteSlug:string;locale:string;pageSlug:string}>}){
 const {siteSlug,locale,pageSlug}=await params;
 if(locale!=="ar"&&locale!=="en")notFound();
 const supabase=await createClient();
 const {data:site,error:siteError}=await supabase.from("builder_sites").select("id,name,default_locale").eq("slug",siteSlug).maybeSingle();
 if(siteError||!site)notFound();
 const {data:navigationPages}=await supabase.from("builder_pages").select("title,slug,locale").eq("site_id",site.id).eq("locale",locale).order("sort_order",{ascending:true}).order("created_at",{ascending:true});
  const {data:page,error:pageError}=await supabase.from("builder_pages").select("id,title,locale").eq("site_id",site.id).eq("slug",pageSlug).eq("locale",locale).maybeSingle();
 if(pageError||!page)notFound();
 const otherLocale=locale==="ar"?"en":"ar";const {data:alternatePage}=await supabase.from("builder_pages").select("slug").eq("site_id",site.id).eq("slug",pageSlug).eq("locale",otherLocale).maybeSingle();
 const {data:version,error:versionError}=await supabase.from("builder_page_versions").select("document,version_no").eq("page_id",page.id).eq("status","published").order("version_no",{ascending:false}).limit(1).maybeSingle();
 if(versionError||!version||!validateBuilderDocument(version.document))notFound();
 const imageUrls:Record<string,string>={};
 await Promise.all(version.document.blocks.filter(block=>block.props.imagePath).map(async block=>{
  const path=block.props.imagePath!;
  const {data}=await supabase.storage.from("builder-media").createSignedUrl(path,600);
  if(data?.signedUrl)imageUrls[path]=data.signedUrl;
 }));
 const ar=locale==="ar";const theme=version.document.theme??defaultBuilderTheme;
 return <main className="published-site" style={{backgroundColor:theme.backgroundColor,color:theme.textColor,fontFamily:theme.fontFamily==="serif"?"Georgia,serif":"Arial,sans-serif"}} dir={ar?"rtl":"ltr"} lang={locale}>
  <header className="published-header"><a href={"/sites/"+siteSlug+"/"+locale+"/home"}>{site.name}</a><nav>{(navigationPages||[]).map(item=><a key={item.slug} href={"/sites/"+siteSlug+"/"+locale+"/"+item.slug}>{item.title}</a>)}{alternatePage&&<a href={"/sites/"+siteSlug+"/"+otherLocale+"/"+alternatePage.slug}>{ar?"English":"العربية"}</a>}</nav></header>
  {version.document.blocks.map(block=><section className={"published-block published-"+block.type} style={{backgroundColor:block.props.backgroundColor??theme.backgroundColor,textAlign:block.props.align??"center"}} key={block.id}>
   <h1 style={{color:theme.accentColor}}>{block.props.title}</h1><p style={{color:theme.textColor}}>{block.props.body}</p>
   {block.props.imagePath&&imageUrls[block.props.imagePath]&&<img src={imageUrls[block.props.imagePath]} alt={block.props.title}/>}
   {block.type==="hero"&&<a className="published-cta" style={{backgroundColor:theme.accentColor}} href={block.props.buttonUrl??"#contact"}>{block.props.buttonText||(ar?"تواصل معنا":"Get in touch")}</a>}
  </section>)}
  <footer id="contact" className="published-footer">© {new Date().getFullYear()} {site.name}</footer>
 </main>;
}
