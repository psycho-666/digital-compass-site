import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import "./public-events.css";
type Props={params:Promise<{siteSlug:string}>};
export default async function PublicEvents({params}:Props){
 const {siteSlug}=await params,db=await createClient();const {data:site}=await db.from("builder_sites").select("id,name,slug,default_locale").eq("slug",siteSlug).maybeSingle();if(!site)notFound();
 const {data:events}=await db.from("builder_events").select("id,title,slug,description,venue,starts_at,ends_at,price,currency").eq("site_id",site.id).eq("status","published").gte("ends_at",new Date().toISOString()).order("starts_at");
 const ar=site.default_locale!=="en";
 return <main className="public-events" dir={ar?"rtl":"ltr"}><header><Link href={"/events/"+siteSlug}>◈ {site.name}</Link><span>EVENTS</span></header><section className="public-events-hero"><p>{ar?"فعالياتنا القادمة":"WHAT'S ON"}</p><h1>{ar?"الفعاليات القادمة":"Upcoming events"}</h1><span>{ar?"اكتشف الفعاليات القادمة وسجّل اهتمامك.":"Discover upcoming events and find the details."}</span></section>{events?.length?<div className="public-event-grid">{events.map(e=><Link href={"/events/"+siteSlug+"/"+e.slug} className="public-event-card" key={e.id}><span>{new Date(e.starts_at).toLocaleString(ar?"ar-IQ":"en-US")}</span><h2>{e.title}</h2><p>{e.description}</p><small>{e.venue|| (ar?"المكان سيُعلن لاحقاً":"Venue to be announced")}</small><strong>{Number(e.price).toLocaleString()} {e.currency}</strong></Link>)}</div>:<p className="public-event-empty">{ar?"لا توجد فعاليات قادمة حالياً.":"No upcoming events at the moment."}</p>}<footer>{site.name}</footer></main>;
}
