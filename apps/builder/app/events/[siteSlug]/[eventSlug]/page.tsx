import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import "../public-events.css";
type Props={params:Promise<{siteSlug:string;eventSlug:string}>};
export default async function PublicEventDetail({params}:Props){
 const {siteSlug,eventSlug}=await params,db=await createClient();const {data:site}=await db.from("builder_sites").select("id,name,slug,default_locale").eq("slug",siteSlug).maybeSingle();if(!site)notFound();
 const {data:event}=await db.from("builder_events").select("title,slug,description,venue,starts_at,ends_at,price,currency,capacity,registration_enabled").eq("site_id",site.id).eq("slug",eventSlug).eq("status","published").maybeSingle();if(!event)notFound();
 const ar=site.default_locale!=="en";
 return <main className="public-events" dir={ar?"rtl":"ltr"}><header><Link href={"/events/"+siteSlug}>◈ {site.name}</Link><Link href={"/events/"+siteSlug}>{ar?"كل الفعاليات":"All events"}</Link></header><article className="public-event-detail"><p>{ar?"تفاصيل الفعالية":"EVENT DETAILS"}</p><h1>{event.title}</h1><h3>{new Date(event.starts_at).toLocaleString(ar?"ar-IQ":"en-US")} – {new Date(event.ends_at).toLocaleString(ar?"ar-IQ":"en-US")}</h3><h3>{event.venue|| (ar?"المكان سيُعلن لاحقاً":"Venue to be announced")}</h3><div>{event.description}</div><strong>{Number(event.price).toLocaleString()} {event.currency}</strong>{event.capacity?<small>{ar?"السعة":"Capacity"}: {event.capacity}</small>:null}<aside>{event.registration_enabled?(ar?"التسجيل الإلكتروني غير متاح بعد. يرجى التواصل مع الجهة المنظمة.":"Online registration is not available yet. Please contact the organizer."): (ar?"التسجيل مغلق حالياً.":"Registration is currently closed.")}</aside><Link href={"/events/"+siteSlug}>{ar?"العودة إلى الفعاليات":"Back to events"}</Link></article><footer>{site.name}</footer></main>;
}
