import { useEffect, useState } from 'react'
import { BriefcaseBusiness, Plus, RefreshCw, Save, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Client = Record<string, any>
export default function ClientsModule({userId,locale}:{userId:string;locale:'ar'|'en'}) {
 const ar=locale==='ar'
 const [rows,setRows]=useState<Client[]>([])
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [form,setForm]=useState({business_name:'',industry:'',location:'',platform:'facebook',account_url:'',contact_info:'',notes:''})
 const t=ar?{title:'إدارة العملاء',add:'إضافة عميل',name:'اسم العميل / النشاط',industry:'النشاط',location:'الموقع',platform:'المنصة',url:'رابط الحساب',contact:'معلومات التواصل',notes:'ملاحظات',next:'الخطوة القادمة',save:'حفظ التغييرات',empty:'لا يوجد عملاء بعد. يمكنك تحويل عميل محتمل إلى عميل من وحدة الاكتشاف.',refresh:'تحديث',status:'الحالة',open:'فتح الحساب',saved:'تم حفظ بيانات العميل'}:{title:'Client management',add:'Add client',name:'Client / business name',industry:'Industry',location:'Location',platform:'Platform',url:'Account URL',contact:'Contact details',notes:'Notes',next:'Next action',save:'Save changes',empty:'No clients yet. Promote a prospect to client from Prospect Discovery.',refresh:'Refresh',status:'Status',open:'Open account',saved:'Client details saved'}
 async function load(){if(!supabase){setLoading(false);return}setLoading(true);const {data,error}=await supabase.from('prospects').select('id,business_name,industry,location,platform,account_url,contact_info,notes,next_action,status,qualification_score,updated_at').eq('user_id',userId).eq('status','client').order('updated_at',{ascending:false});if(error)setNotice(error.message);setRows(data||[]);setLoading(false)}
 useEffect(()=>{void load()},[userId])
 function patch(id:string,key:string,value:string){setRows(v=>v.map(r=>r.id===id?{...r,[key]:value}:r))}
 async function add(e:React.FormEvent){e.preventDefault();if(!supabase||!form.business_name.trim())return;setBusy(true);const {error}=await supabase.from('prospects').insert({...form,user_id:userId,status:'client',source:'manual_client'});setBusy(false);if(error){setNotice(error.message);return}setForm({business_name:'',industry:'',location:'',platform:'facebook',account_url:'',contact_info:'',notes:''});setNotice(t.saved);await load()}
 async function save(row:Client){if(!supabase)return;setBusy(true);const {error}=await supabase.from('prospects').update({contact_info:row.contact_info,notes:row.notes,next_action:row.next_action,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',userId);setBusy(false);setNotice(error?error.message:t.saved);if(!error)await load()}
 async function changeStatus(row:Client,status:string){if(!supabase)return;const {error}=await supabase.from('prospects').update({status,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',userId);if(error)setNotice(error.message);else await load()}
 return <div className="social-module-wrap" dir={ar?'rtl':'ltr'}>
  <div className="module-toolbar"><span>{t.title}</span><button className="subtle-button" onClick={()=>void load()}><RefreshCw size={15}/>{t.refresh}</button></div>
  {notice&&<div className="notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
  <div className="planner-grid">
   <section className="panel"><div className="panel-head"><h3>{t.add}</h3><Plus size={18}/></div><form className="module-form" onSubmit={add}>
    <label>{t.name}<input required value={form.business_name} onChange={e=>setForm(v=>({...v,business_name:e.target.value}))}/></label>
    <label>{t.industry}<input value={form.industry} onChange={e=>setForm(v=>({...v,industry:e.target.value}))}/></label>
    <label>{t.location}<input value={form.location} onChange={e=>setForm(v=>({...v,location:e.target.value}))}/></label>
    <label>{t.platform}<select value={form.platform} onChange={e=>setForm(v=>({...v,platform:e.target.value}))}>{['facebook','instagram','tiktok','linkedin','other'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>{t.url}<input type="url" value={form.account_url} onChange={e=>setForm(v=>({...v,account_url:e.target.value}))}/></label>
    <label>{t.contact}<input value={form.contact_info} onChange={e=>setForm(v=>({...v,contact_info:e.target.value}))}/></label>
    <label>{t.notes}<textarea rows={3} value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></label>
    <button className="primary-button" disabled={busy}><Plus size={15}/>{t.add}</button>
   </form></section>
   <section className="panel"><div className="panel-head"><h3><BriefcaseBusiness size={17}/>{t.title}</h3><span className="status-pill">{rows.length}</span></div>
    {loading?<div className="small-empty">{ar?'جارٍ التحميل...':'Loading...'}</div>:rows.length===0?<div className="small-empty">{t.empty}</div>:<div className="data-list">{rows.map(row=><article className="comment-card" key={row.id}>
     <div className="comment-top"><strong>{row.business_name}</strong><span className="status-pill">{row.qualification_score??'—'}/100</span></div><small>{[row.platform,row.industry,row.location].filter(Boolean).join(' · ')}</small>
     <label>{t.contact}<input value={row.contact_info||''} onChange={e=>patch(row.id,'contact_info',e.target.value)}/></label>
     <label>{t.notes}<textarea rows={2} value={row.notes||''} onChange={e=>patch(row.id,'notes',e.target.value)}/></label>
     <label>{t.next}<input value={row.next_action||''} onChange={e=>patch(row.id,'next_action',e.target.value)}/></label>
     <div className="reply-row"><button className="primary-button" disabled={busy} onClick={()=>void save(row)}><Save size={14}/>{t.save}</button><select value={row.status} onChange={e=>void changeStatus(row,e.target.value)} aria-label={t.status}><option value="client">client</option><option value="contacted">contacted</option><option value="archived">archived</option></select>{row.account_url&&<a className="outline-button" href={row.account_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/>{t.open}</a>}</div>
    </article>)}</div>}
   </section>
  </div>
 </div>
}
