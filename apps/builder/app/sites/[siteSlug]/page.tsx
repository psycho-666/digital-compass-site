import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export const dynamic="force-dynamic";

export default async function PublishedSiteRoot({params}:{params:Promise<{siteSlug:string}>}){
 const {siteSlug}=await params;
 const supabase=await createClient();
 const {data:site,error}=await supabase.from("builder_sites").select("id,default_locale").eq("slug",siteSlug).maybeSingle();
 if(error||!site)notFound();
 const {data:home,error:homeError}=await supabase.from("builder_pages").select("slug").eq("site_id",site.id).eq("locale",site.default_locale).eq("is_home",true).maybeSingle();
 if(homeError)notFound();
 redirect("/sites/"+siteSlug+"/"+site.default_locale+"/"+(home?.slug??"home"));
}
