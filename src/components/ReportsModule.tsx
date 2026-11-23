import { useEffect, useState } from 'react'
import { Activity, RefreshCw, MessageCircle, MessageSquareText, CalendarDays, Users, Globe2, WandSparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Metric={label:string;value:number;icon:any}
export default function ReportsModule({userId,locale}:{userId:string;locale:'ar'|'en'}) {
 const ar=locale==='ar'
 const [values,setValues]=useState<Record<string,number>>({})
 const [loading,setLoading]=useState(true),[notice,setNotice]=useState('')
 const labels=ar?{title:'التقارير والإحصاءات',pages:'الحسابات النشطة',conversations:'المحادثات',messages:'الرسائل خلال 30 يوماً',comments:'التعليقات خلال 30 يوماً',published:'المنشورات المنشورة خلال 30 يوماً',scheduled:'منشورات بانتظار النشر',prospects:'العملاء المحتملون',clients:'العملاء',automations:'قواعد الأتمتة المفعّلة',refresh:'تحديث',period:'ملخص آخر 30 يوماً'}:{title:'Reports & analytics',pages:'Active accounts',conversations:'Conversations',messages:'Messages in last 30 days',comments:'Comments in last 30 days',published:'Posts published in last 30 days',scheduled:'Posts awaiting publication',prospects:'Prospects',clients:'Clients',automations:'Enabled automation rules',refresh:'Refresh',period:'Last 30 days summary'}
 async function load(){if(!supabase){setLoading(false);return}setLoading(true);setNotice('');const since=new Date(Date.now()-30*86400000).toISOString();const specs=[
  ['pages',supabase.from('connected_pages').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('is_active',true)],
  ['conversations',supabase.from('conversations').select('id',{count:'exact',head:true}).eq('user_id',userId)],
  ['messages',supabase.from('messages').select('id',{count:'exact',head:true}).eq('user_id',userId).gte('sent_at',since)],
  ['comments',supabase.from('comments').select('id',{count:'exact',head:true}).eq('user_id',userId).gte('commented_at',since)],
  ['published',supabase.from('scheduled_posts').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('status','published').gte('published_at',since)],
  ['scheduled',supabase.from('scheduled_posts').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('status','scheduled')],
  ['prospects',supabase.from('prospects').select('id',{count:'exact',head:true}).eq('user_id',userId).neq('status','client')],
  ['clients',supabase.from('prospects').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('status','client')],
  ['automations',supabase.from('automation_rules').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('is_enabled',true)]
 ] as const;
 const results=await Promise.all(specs.map(async([key,query])=>({key,result:await query})));const errors=results.filter(x=>x.result.error);if(errors.length)setNotice(errors[0].result.error?.message||'Could not load report data');const next:Record<string,number>={};for(const item of results)next[item.key]=item.result.count||0;setValues(next);setLoading(false)}
 useEffect(()=>{void load()},[userId])
 const metrics:Metric[]=[{label:labels.pages,value:values.pages||0,icon:Globe2},{label:labels.conversations,value:values.conversations||0,icon:MessageCircle},{label:labels.messages,value:values.messages||0,icon:MessageCircle},{label:labels.comments,value:values.comments||0,icon:MessageSquareText},{label:labels.published,value:values.published||0,icon:CalendarDays},{label:labels.scheduled,value:values.scheduled||0,icon:CalendarDays},{label:labels.prospects,value:values.prospects||0,icon:Users},{label:labels.clients,value:values.clients||0,icon:Users},{label:labels.automations,value:values.automations||0,icon:WandSparkles}]
 return <div className="social-module-wrap" dir={ar?'rtl':'ltr'}>
  <div className="module-toolbar"><span>{labels.title}</span><button className="subtle-button" onClick={()=>void load()}><RefreshCw size={15}/>{labels.refresh}</button></div>
  {notice&&<div className="notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  <section className="panel"><div className="panel-head"><div><h3>{labels.period}</h3><p>{ar?'بيانات مساحة العمل المسجلة في البوصلة الرقمية.':'Workspace activity recorded in Digital Compass.'}</p></div><Activity size={19}/></div>
   {loading?<div className="small-empty">{ar?'جارٍ إعداد التقرير...':'Preparing report...'}</div>:<div className="stats-grid">{metrics.map(item=>{const Icon=item.icon;return <div key={item.label}><small><Icon size={15}/> {item.label}</small><strong>{item.value.toLocaleString(ar?'ar-IQ':'en-US')}</strong></div>})}</div>}
  </section>
 </div>
}
