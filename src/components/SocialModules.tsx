import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, MessageCircle, MessageSquareText, Send, WandSparkles, Sparkles, Clock3, Plus, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Section = 'inbox' | 'comments' | 'planner' | 'automation' | 'assistant' | 'settings'
type Row = Record<string, any>
type Props = { section: Section; locale: 'ar' | 'en'; userId: string }
const words = {
 ar: { inbox:'الرسائل',comments:'التعليقات',planner:'تقويم المحتوى',automation:'الأتمتة',assistant:'المساعد الذكي',settings:'الإعدادات',loading:'جارٍ التحميل...',refresh:'تحديث',none:'لا توجد بيانات بعد. اربط صفحات Meta لاستقبال التفاعلات.',connect:'اذهب إلى الحسابات المرتبطة لربط Meta.',conversation:'اختر محادثة لعرض الرسائل',message:'اكتب رسالتك...',send:'إرسال',comment:'التعليق',author:'صاحب التعليق',reply:'اكتب الرد على التعليق...',replied:'تم الرد',pending:'بانتظار الرد',newPost:'إنشاء منشور',page:'الصفحة',caption:'نص المنشور',schedule:'موعد النشر',draft:'حفظ كمسودة',scheduleBtn:'جدولة المنشور',rule:'قاعدة جديدة',ruleName:'اسم القاعدة',keyword:'الكلمة أو العبارة المحفزة',replyText:'نص الرد التلقائي',add:'إضافة القاعدة',enabled:'مفعلة',disabled:'متوقفة',noPages:'لا توجد صفحات مرتبطة',assistantHint:'سيتم تفعيل المساعد الذكي بعد ربط مزود الذكاء الاصطناعي.',settingsHint:'إعدادات مساحة العمل والحساب.',error:'تعذر إكمال العملية',saved:'تم الحفظ',draftStatus:'مسودة',scheduledStatus:'مجدول',status:'الحالة',empty:'لا توجد عناصر لعرضها',cancel:'إلغاء',choosePage:'اختر صفحة'},
 en: { inbox:'Inbox',comments:'Comments',planner:'Content planner',automation:'Automation',assistant:'AI assistant',settings:'Settings',loading:'Loading...',refresh:'Refresh',none:'No data yet. Connect Meta pages to receive activity.',connect:'Open connected accounts to connect Meta.',conversation:'Select a conversation to view messages',message:'Write a message...',send:'Send',comment:'Comment',author:'Author',reply:'Write a comment reply...',replied:'Replied',pending:'Awaiting reply',newPost:'Create post',page:'Page',caption:'Post caption',schedule:'Publish time',draft:'Save draft',scheduleBtn:'Schedule post',rule:'New automation rule',ruleName:'Rule name',keyword:'Trigger keyword or phrase',replyText:'Automatic reply text',add:'Add rule',enabled:'Enabled',disabled:'Disabled',noPages:'No connected pages',assistantHint:'The AI assistant will be enabled after an AI provider is configured.',settingsHint:'Workspace and account settings.',error:'The action could not be completed',saved:'Saved',draftStatus:'Draft',scheduledStatus:'Scheduled',status:'Status',empty:'Nothing to show',cancel:'Cancel',choosePage:'Choose a page'}
}
export default function SocialModules({section,locale,userId}:Props) {
 const t=words[locale], rtl=locale==='ar'
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [pages,setPages]=useState<Row[]>([]),[conversations,setConversations]=useState<Row[]>([]),[comments,setComments]=useState<Row[]>([]),[posts,setPosts]=useState<Row[]>([]),[rules,setRules]=useState<Row[]>([])
 const [selected,setSelected]=useState<Row|null>(null),[messages,setMessages]=useState<Row[]>([]),[message,setMessage]=useState('')
 const [replies,setReplies]=useState<Record<string,string>>({})
 const [pageId,setPageId]=useState(''),[caption,setCaption]=useState(''),[scheduledFor,setScheduledFor]=useState('')
 const [ruleName,setRuleName]=useState(''),[keyword,setKeyword]=useState(''),[replyText,setReplyText]=useState('')
 async function load() {
  if(!supabase){setLoading(false);return}
  setLoading(true);setNotice('')
  const [p,c,cm,po,ru]=await Promise.all([
   supabase.from('connected_pages').select('id,platform,page_name,external_page_id').eq('user_id',userId).order('created_at',{ascending:false}),
   supabase.from('conversations').select('*').eq('user_id',userId).order('last_message_at',{ascending:false}),
   supabase.from('comments').select('*').eq('user_id',userId).order('commented_at',{ascending:false}).limit(100),
   supabase.from('scheduled_posts').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
   supabase.from('automation_rules').select('*').eq('user_id',userId).order('created_at',{ascending:false})
  ])
  const error=[p.error,c.error,cm.error,po.error,ru.error].find(Boolean)
  if(error)setNotice(error.message)
  setPages(p.data||[]);setConversations(c.data||[]);setComments(cm.data||[]);setPosts(po.data||[]);setRules(ru.data||[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[section,userId])
 async function openConversation(row:Row) {
  setSelected(row);if(!supabase)return
  const {data,error}=await supabase.from('messages').select('*').eq('conversation_id',row.id).eq('user_id',userId).order('sent_at')
  if(error)setNotice(error.message);setMessages(data||[])
 }
 async function sendMessage(e:FormEvent) {
  e.preventDefault();if(!supabase||!selected||!message.trim())return
  setBusy(true);setNotice('')
  const {error}=await supabase.functions.invoke('social-management-api',{body:{action:'send_message',conversation_id:selected.id,message:message.trim()}})
  setBusy(false);if(error){setNotice(error.message);return}
  setMessage('');await openConversation(selected);await load()
 }
 async function replyComment(id:string) {
  if(!supabase||!replies[id]?.trim())return
  setBusy(true);setNotice('')
  const {error}=await supabase.functions.invoke('social-management-api',{body:{action:'reply_comment',comment_id:id,reply:replies[id].trim()}})
  setBusy(false);if(error){setNotice(error.message);return}
  setReplies(v=>({...v,[id]:''}));await load()
 }
 async function savePost(e:FormEvent) {
  e.preventDefault();if(!supabase||!pageId||!caption.trim())return
  setBusy(true);const hasDate=Boolean(scheduledFor)
  const {error}=await supabase.from('scheduled_posts').insert({user_id:userId,page_id:pageId,caption:caption.trim(),scheduled_for:hasDate?new Date(scheduledFor).toISOString():null,status:hasDate?'scheduled':'draft'})
  setBusy(false);if(error){setNotice(error.message);return}
  setCaption('');setScheduledFor('');setNotice(t.saved);await load()
 }
 async function addRule(e:FormEvent) {
  e.preventDefault();if(!supabase||!ruleName.trim()||!replyText.trim())return
  setBusy(true);const {error}=await supabase.from('automation_rules').insert({user_id:userId,name:ruleName.trim(),trigger_type:'comment_keyword',trigger_value:keyword.trim(),reply_text:replyText.trim(),is_enabled:false})
  setBusy(false);if(error){setNotice(error.message);return}
  setRuleName('');setKeyword('');setReplyText('');setNotice(t.saved);await load()
 }
 async function toggleRule(rule:Row) {
  if(!supabase)return
  const {error}=await supabase.from('automation_rules').update({is_enabled:!rule.is_enabled}).eq('id',rule.id).eq('user_id',userId)
  if(error)setNotice(error.message);else await load()
 }
 if(loading)return <section className="panel module-panel"><div className="module-icon"><RefreshCw size={22}/></div><p>{t.loading}</p></section>
 return <div className="social-module-wrap" dir={rtl?'rtl':'ltr'}>
  <div className="module-toolbar"><span>{t[section]}</span><button className="subtle-button" onClick={()=>void load()}><RefreshCw size={15}/>{t.refresh}</button></div>
  {notice&&<div className="notice"><AlertCircle size={15}/><span>{notice}</span><button onClick={()=>setNotice('')}>×</button></div>}
  {section==='inbox'&&<section className="panel inbox-layout"><div className="conversation-list"><div className="panel-head"><h3>{t.inbox}</h3><MessageCircle size={17}/></div>{conversations.length===0?<div className="small-empty">{t.none}<p>{t.connect}</p></div>:conversations.map(c=><button className={selected?.id===c.id?'conversation-item selected':'conversation-item'} key={c.id} onClick={()=>void openConversation(c)}><span className="contact-avatar">{(c.participant_name||'?')[0]}</span><span className="data-main"><strong>{c.participant_name||'Social user'}</strong><small>{c.last_message||''}</small></span>{c.unread_count>0&&<i className="unread-count">{c.unread_count}</i>}</button>)}</div><div className="chat-panel">{!selected?<div className="empty-state"><div className="empty-icon"><MessageCircle size={22}/></div><strong>{t.conversation}</strong></div>:<><div className="chat-header"><strong>{selected.participant_name||'Conversation'}</strong><small>{selected.status}</small></div><div className="chat-messages">{messages.map(m=><div className={m.direction==='outbound'?'chat-bubble outgoing':'chat-bubble'} key={m.id}>{m.body}<small>{new Date(m.sent_at).toLocaleString(locale==='ar'?'ar-IQ':'en-US')}</small></div>)}</div><form className="chat-compose" onSubmit={sendMessage}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder={t.message}/><button className="primary-button" disabled={busy||!message.trim()}><Send size={16}/></button></form></>}</div></section>}
  {section==='comments'&&<section className="panel"><div className="panel-head"><h3>{t.comments}</h3><MessageSquareText size={17}/></div>{comments.length===0?<div className="small-empty">{t.none}<p>{t.connect}</p></div>:<div className="data-list">{comments.map(c=><article className="comment-card" key={c.id}><div className="comment-top"><strong>{c.author_name||'Social user'}</strong><span className={c.status==='replied'?'status-pill':'status-pill pending'}>{c.status==='replied'?t.replied:t.pending}</span></div><p>{c.body}</p>{c.status!=='replied'&&<div className="reply-row"><input value={replies[c.id]||''} onChange={e=>setReplies(v=>({...v,[c.id]:e.target.value}))} placeholder={t.reply}/><button className="primary-button" disabled={busy||!replies[c.id]?.trim()} onClick={()=>void replyComment(c.id)}>{t.send}</button></div>}{c.reply_text&&<div className="existing-reply">{c.reply_text}</div>}</article>)}</div>}</section>}
  {section==='planner'&&<div className="planner-grid"><section className="panel"><div className="panel-head"><h3>{t.newPost}</h3><CalendarDays size={18}/></div><form className="module-form" onSubmit={savePost}><label>{t.page}<select value={pageId} onChange={e=>setPageId(e.target.value)} required><option value="">{t.choosePage}</option>{pages.map(p=><option key={p.id} value={p.id}>{p.page_name} · {p.platform}</option>)}</select></label><label>{t.caption}<textarea rows={5} value={caption} onChange={e=>setCaption(e.target.value)} required/></label><label>{t.schedule}<input type="datetime-local" value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)}/></label><button className="primary-button" disabled={busy||pages.length===0}><Plus size={16}/>{scheduledFor?t.scheduleBtn:t.draft}</button>{pages.length===0&&<small className="muted-note">{t.noPages}</small>}</form></section><section className="panel"><div className="panel-head"><h3>{t.planner}</h3><Clock3 size={17}/></div>{posts.length===0?<div className="small-empty">{t.empty}</div>:<div className="data-list">{posts.map(p=><div className="data-row" key={p.id}><div className="quick-icon violet"><CalendarDays size={17}/></div><div className="data-main"><strong>{p.caption.slice(0,80)||t.newPost}</strong><small>{p.scheduled_for?new Date(p.scheduled_for).toLocaleString():t.draft}</small></div><span className="status-pill">{p.status==='scheduled'?t.scheduledStatus:t.draftStatus}</span></div>)}</div>}</section></div>}
  {section==='automation'&&<div className="planner-grid"><section className="panel"><div className="panel-head"><h3>{t.rule}</h3><WandSparkles size={18}/></div><form className="module-form" onSubmit={addRule}><label>{t.ruleName}<input value={ruleName} onChange={e=>setRuleName(e.target.value)} required/></label><label>{t.keyword}<input value={keyword} onChange={e=>setKeyword(e.target.value)}/></label><label>{t.replyText}<textarea rows={4} value={replyText} onChange={e=>setReplyText(e.target.value)} required/></label><button className="primary-button" disabled={busy}><Plus size={16}/>{t.add}</button></form></section><section className="panel"><div className="panel-head"><h3>{t.automation}</h3><WandSparkles size={17}/></div>{rules.length===0?<div className="small-empty">{t.empty}</div>:<div className="data-list">{rules.map(rule=><div className="data-row" key={rule.id}><div className="data-main"><strong>{rule.name}</strong><small>{rule.trigger_value||rule.trigger_type} · {rule.reply_text}</small></div><button className={rule.is_enabled?'toggle-button enabled':'toggle-button'} onClick={()=>void toggleRule(rule)}>{rule.is_enabled?t.enabled:t.disabled}</button></div>)}</div>}</section></div>}
  {section==='assistant'&&<section className="panel module-panel"><div className="module-icon"><Sparkles size={23}/></div><h2>{t.assistant}</h2><p>{t.assistantHint}</p></section>}
  {section==='settings'&&<section className="panel module-panel"><div className="module-icon"><CheckCircle2 size={23}/></div><h2>{t.settings}</h2><p>{t.settingsHint}</p></section>}
 </div>
}