import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, MessageCircle, MessageSquareText, Send, WandSparkles, Sparkles, Clock3, Plus, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Section = 'inbox' | 'comments' | 'planner' | 'automation' | 'assistant' | 'settings'
type Row = Record<string, any>
type Props = { section: Section; locale: 'ar' | 'en'; userId: string }
const words = {
 ar: { inbox:'الرسائل',comments:'التعليقات',planner:'تقويم المحتوى',automation:'الأتمتة',assistant:'المساعد الذكي',settings:'الإعدادات',loading:'جارٍ التحميل...',refresh:'تحديث',none:'لا توجد بيانات بعد. اربط صفحات Meta لاستقبال التفاعلات.',connect:'اذهب إلى الحسابات المرتبطة لربط Meta.',conversation:'اختر محادثة لعرض الرسائل',message:'اكتب رسالتك...',send:'إرسال',comment:'التعليق',author:'صاحب التعليق',reply:'اكتب الرد على التعليق...',replied:'تم الرد',pending:'بانتظار الرد',newPost:'إنشاء منشور',page:'الصفحة',caption:'نص المنشور',designTitle:'مصمم منشورات مجاني - 3 قوالب مختلفة',designBrief:'اشرح محتوى المنشور المطلوب',audience:'الجمهور المستهدف',tone:'أسلوب التصميم',colors:'ألوان العلامة التجارية',generate:'إنشاء 3 نماذج تصميم',chooseDesign:'اعتماد هذا التصميم',chosen:'التصميم المختار',media:'صورة أو فيديو (حتى 500MB)',schedule:'موعد النشر',draft:'حفظ كمسودة',scheduleBtn:'جدولة المنشور',rule:'قاعدة جديدة',ruleName:'اسم القاعدة',keyword:'الكلمة أو العبارة المحفزة',replyText:'نص الرد التلقائي',triggerType:'نوع التفاعل',commentTrigger:'تعليق يحتوي كلمة',messageTrigger:'رسالة واردة تحتوي كلمة',allPages:'كل الصفحات',add:'إضافة القاعدة',enabled:'مفعلة',disabled:'متوقفة',noPages:'لا توجد صفحات مرتبطة',assistantHint:'اسأل المساعد عن المحتوى والتفاعل وإدارة صفحاتك وخطط النشر.',assistantPlaceholder:'اكتب سؤالك أو طلبك...',assistantSend:'إرسال',assistantThinking:'يفكر الآن...',assistantWelcome:'أنا مساعدك لإدارة التسويق عبر منصات التواصل. كيف أساعدك؟',settingsHint:'إعدادات مساحة العمل والحساب.',error:'تعذر إكمال العملية',saved:'تم الحفظ',draftStatus:'مسودة',scheduledStatus:'مجدول',status:'الحالة',empty:'لا توجد عناصر لعرضها',cancel:'إلغاء',choosePage:'اختر صفحة'},
 en: { inbox:'Inbox',comments:'Comments',planner:'Content planner',automation:'Automation',assistant:'AI assistant',settings:'Settings',loading:'Loading...',refresh:'Refresh',none:'No data yet. Connect Meta pages to receive activity.',connect:'Open connected accounts to connect Meta.',conversation:'Select a conversation to view messages',message:'Write a message...',send:'Send',comment:'Comment',author:'Author',reply:'Write a comment reply...',replied:'Replied',pending:'Awaiting reply',newPost:'Create post',page:'Page',caption:'Post caption',designTitle:'Free post designer - 3 distinct layouts',designBrief:'Describe the post you want',audience:'Target audience',tone:'Design tone',colors:'Brand colors',generate:'Generate 3 design options',chooseDesign:'Use this design',chosen:'Selected design',media:'Image or video (up to 500MB)',schedule:'Publish time',draft:'Save draft',scheduleBtn:'Schedule post',rule:'New automation rule',ruleName:'Rule name',keyword:'Trigger keyword or phrase',replyText:'Automatic reply text',triggerType:'Trigger type',commentTrigger:'Comment contains keyword',messageTrigger:'Incoming message contains keyword',allPages:'All pages',add:'Add rule',enabled:'Enabled',disabled:'Disabled',noPages:'No connected pages',assistantHint:'Ask about content, engagement, page management and publishing plans.',assistantPlaceholder:'Type your question or request...',assistantSend:'Send',assistantThinking:'Thinking...',assistantWelcome:'I am your social media marketing assistant. How can I help?',settingsHint:'Workspace and account settings.',error:'The action could not be completed',saved:'Saved',draftStatus:'Draft',scheduledStatus:'Scheduled',status:'Status',empty:'Nothing to show',cancel:'Cancel',choosePage:'Choose a page'}
}

async function makeLocalDesign(brief:string, audience:string, tone:string, colors:string, variant:number, rtl:boolean):Promise<Blob> {
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable');
 const palette=colors.match(/#[0-9a-fA-F]{6}/g)||['#571c63','#342046','#d8b66a'];
 const a=palette[0],b=palette[1]||'#342046',accent=palette[2]||'#d8b66a';
 const headline=brief.trim().split(/[.!؟\n]/)[0].slice(0,90)||brief.slice(0,90);
 const sub=(audience?((rtl?'مخصص لـ ':'For ')+audience):'').slice(0,100);
 const drawWrapped=(text:string,x:number,y:number,max:number,line:number)=>{
  ctx.textAlign=rtl?'right':'left';ctx.direction=rtl?'rtl':'ltr';ctx.font='700 64px Arial, sans-serif';
  const words=text.split(/\s+/);let row='',yy=y;
  for(const word of words){const test=row?row+' '+word:word;if(ctx.measureText(test).width>max&&row){ctx.fillText(row,x,yy);row=word;yy+=line;}else row=test;}
  if(row)ctx.fillText(row,x,yy);
 };
 if(variant===0){
  const g=ctx.createLinearGradient(0,0,1080,1080);g.addColorStop(0,a);g.addColorStop(1,b);ctx.fillStyle=g;ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle=accent;ctx.globalAlpha=.16;ctx.beginPath();ctx.arc(950,120,330,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle='#ffffff';ctx.fillRect(70,70,940,940);ctx.fillStyle=a;ctx.fillRect(70,70,22,940);
  ctx.fillStyle=accent;ctx.fillRect(130,160,160,12);ctx.fillStyle=b;drawWrapped(headline,rtl?930:150,390,740,88);
  ctx.fillStyle='#5b5560';ctx.font='400 34px Arial';ctx.textAlign=rtl?'right':'left';ctx.direction=rtl?'rtl':'ltr';ctx.fillText(sub,rtl?930:150,540);
  ctx.fillStyle=a;ctx.fillRect(130,800,820,3);ctx.font='700 28px Arial';ctx.fillText(tone||'DIGITAL COMPASS',rtl?930:150,870);
 } else if(variant===1){
  ctx.fillStyle='#f5f0e8';ctx.fillRect(0,0,1080,1080);ctx.fillStyle=a;ctx.fillRect(0,0,1080,610);
  ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(0,610);ctx.lineTo(1080,490);ctx.lineTo(1080,650);ctx.lineTo(0,770);ctx.fill();
  ctx.fillStyle='#ffffff';ctx.font='700 76px Arial';ctx.textAlign=rtl?'right':'left';ctx.direction=rtl?'rtl':'ltr';drawWrapped(headline,rtl?950:130,330,820,98);
  ctx.fillStyle=b;ctx.font='600 36px Arial';ctx.fillText(sub,rtl?950:130,840);
  ctx.fillStyle=a;ctx.font='700 25px Arial';ctx.fillText(tone||'SPECIAL OFFER',rtl?950:130,930);
  ctx.strokeStyle=b;ctx.lineWidth=5;ctx.strokeRect(55,55,970,970);
 } else {
  ctx.fillStyle='#171421';ctx.fillRect(0,0,1080,1080);ctx.strokeStyle=a;ctx.lineWidth=3;
  for(let i=0;i<9;i++){ctx.beginPath();ctx.arc(850,250,90+i*48,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle=accent;ctx.fillRect(100,140,12,790);ctx.fillStyle='#ffffff';drawWrapped(headline,rtl?930:150,450,760,90);
  ctx.fillStyle='#c9c3d0';ctx.font='400 32px Arial';ctx.textAlign=rtl?'right':'left';ctx.direction=rtl?'rtl':'ltr';ctx.fillText(sub,rtl?930:150,640);
  ctx.fillStyle=accent;ctx.font='700 27px Arial';ctx.fillText(tone||'DIGITAL COMPASS',rtl?930:150,850);
 }
 return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not export design image')),'image/png'));
}
\nasync function functionErrorMessage(error: any, fallback: string) {
 try {
  const response = error?.context
  if (response && typeof response.clone === 'function') {
   const body = await response.clone().json()
   if (typeof body?.error === 'string' && body.error.trim()) return body.error
  }
 } catch {}
 return error?.message || fallback
}
export default function SocialModules({section,locale,userId}:Props) {
 const t=words[locale], rtl=locale==='ar'
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [pages,setPages]=useState<Row[]>([]),[conversations,setConversations]=useState<Row[]>([]),[comments,setComments]=useState<Row[]>([]),[posts,setPosts]=useState<Row[]>([]),[rules,setRules]=useState<Row[]>([])
 const [selected,setSelected]=useState<Row|null>(null),[messages,setMessages]=useState<Row[]>([]),[message,setMessage]=useState('')
 const [replies,setReplies]=useState<Record<string,string>>({})
 const [pageId,setPageId]=useState(''),[caption,setCaption]=useState(''),[scheduledFor,setScheduledFor]=useState(''),[mediaFile,setMediaFile]=useState<File|null>(null)
 const [designBrief,setDesignBrief]=useState(''),[designAudience,setDesignAudience]=useState(''),[designTone,setDesignTone]=useState(''),[designColors,setDesignColors]=useState(''),[generatedDesigns,setGeneratedDesigns]=useState<Row[]>([]),[chosenDesign,setChosenDesign]=useState<Row|null>(null)
 const [ruleName,setRuleName]=useState(''),[keyword,setKeyword]=useState(''),[replyText,setReplyText]=useState(''),[ruleType,setRuleType]=useState<'comment_keyword'|'incoming_message'>('comment_keyword'),[rulePageId,setRulePageId]=useState('')
 const [assistantInput,setAssistantInput]=useState(''),[assistantMessages,setAssistantMessages]=useState<Row[]>([]),[assistantBusy,setAssistantBusy]=useState(false)
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
 async function generateDesigns() {
  if(!supabase||!designBrief.trim()){setNotice(rtl?'اكتب وصف المنشور أولاً':'Enter a post brief first');return}
  setBusy(true);setNotice('')
  try {
   const designs:Row[]=[]
   for(const variant of [0,1,2]){
    const blob=await makeLocalDesign(designBrief,designAudience,designTone,designColors,variant,rtl)
    const path=userId+'/generated/local-'+crypto.randomUUID()+'.png'
    const {error:uploadError}=await supabase.storage.from('social-media').upload(path,blob,{contentType:'image/png',upsert:false})
    if(uploadError)throw uploadError
    const {data:signed,error:signedError}=await supabase.storage.from('social-media').createSignedUrl(path,3600)
    if(signedError||!signed?.signedUrl)throw signedError||new Error('Preview URL unavailable')
    designs.push({id:variant+1,path,url:signed.signedUrl})
   }
   setGeneratedDesigns(designs);setChosenDesign(null)
  } catch(error:any) {setNotice(error?.message||t.error)}
  finally {setBusy(false)}
 }
 async function savePost(e:FormEvent) {
  e.preventDefault();if(!supabase||!pageId||!caption.trim())return
  setBusy(true);setNotice('');const hasDate=Boolean(scheduledFor)
  let mediaPath:string|undefined=chosenDesign?.path
  if(!chosenDesign && mediaFile && mediaFile.size>500*1024*1024){setBusy(false);setNotice(rtl?'حجم الملف يتجاوز 500MB':'File exceeds 500MB');return}
  if(!chosenDesign && mediaFile){
   const safeName=mediaFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')
   mediaPath=userId+'/'+crypto.randomUUID()+'-'+safeName
   const {error:uploadError}=await supabase.storage.from('social-media').upload(mediaPath,mediaFile,{contentType:mediaFile.type,upsert:false})
   if(uploadError){setBusy(false);setNotice(uploadError.message);return}
  }
  const {error}=await supabase.from('scheduled_posts').insert({user_id:userId,page_id:pageId,caption:caption.trim(),media_urls:mediaPath?['storage://'+mediaPath]:[],scheduled_for:hasDate?new Date(scheduledFor).toISOString():null,status:hasDate?'scheduled':'draft'})
  setBusy(false);if(error){if(mediaPath)await supabase.storage.from('social-media').remove([mediaPath]);setNotice(error.message);return}
  setCaption('');setScheduledFor('');setMediaFile(null);setChosenDesign(null);setGeneratedDesigns([]);setDesignBrief('');setNotice(t.saved);await load()
 }
 async function addRule(e:FormEvent) {
  e.preventDefault();if(!supabase||!ruleName.trim()||!replyText.trim())return
  setBusy(true);const {error}=await supabase.from('automation_rules').insert({user_id:userId,page_id:rulePageId||null,name:ruleName.trim(),trigger_type:ruleType,trigger_value:keyword.trim(),reply_text:replyText.trim(),is_enabled:false})
  setBusy(false);if(error){setNotice(error.message);return}
  setRuleName('');setKeyword('');setReplyText('');setRulePageId('');setNotice(t.saved);await load()
 }
 async function sendAssistant(e:FormEvent) {
  e.preventDefault();const prompt=assistantInput.trim();if(!supabase||!prompt||assistantBusy)return
  const next=[...assistantMessages,{role:'user',content:prompt}];setAssistantMessages(next);setAssistantInput('');setAssistantBusy(true);setNotice('')
  const {data,error}=await supabase.functions.invoke('assistant-api',{body:{message:prompt,history:assistantMessages.slice(-10).map(m=>({role:m.role,content:m.content}))}})
  setAssistantBusy(false);if(error||data?.error){setNotice(data?.error||await functionErrorMessage(error,t.error));return}
  setAssistantMessages(v=>[...v,{role:'assistant',content:String(data.reply||'')}])
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
  {section==='planner'&&<div className="planner-grid"><section className="panel"><div className="panel-head"><h3>{t.newPost}</h3><CalendarDays size={18}/></div><form className="module-form" onSubmit={savePost}><label>{t.page}<select value={pageId} onChange={e=>setPageId(e.target.value)} required><option value="">{t.choosePage}</option>{pages.map(p=><option key={p.id} value={p.id}>{p.page_name} · {p.platform}</option>)}</select></label><label>{t.caption}<textarea rows={5} value={caption} onChange={e=>setCaption(e.target.value)} required/></label><section className="ai-design-panel"><div className="panel-head"><h3>{t.designTitle}</h3><Sparkles size={18}/></div><label>{t.designBrief}<textarea rows={4} value={designBrief} onChange={e=>setDesignBrief(e.target.value)} placeholder={rtl?"مثال: عرض خصم 20% على منتجك، تصميم أنيق بالأزرق والذهبي":"Example: 20% offer on your product, elegant blue and gold design"}/></label><label>{t.audience}<input value={designAudience} onChange={e=>setDesignAudience(e.target.value)}/></label><label>{t.tone}<input value={designTone} onChange={e=>setDesignTone(e.target.value)}/></label><label>{t.colors}<input value={designColors} onChange={e=>setDesignColors(e.target.value)} placeholder="#571c63, #342046"/></label><button type="button" className="outline-button" disabled={busy||!designBrief.trim()} onClick={()=>void generateDesigns()}><Sparkles size={16}/>{busy?(rtl?"جارٍ التصميم...":"Generating..."):t.generate}</button>{generatedDesigns.length>0&&<div className="ai-design-grid">{generatedDesigns.map((d,i)=><div className={chosenDesign?.id===d.id?"ai-design-option selected":"ai-design-option"} key={d.id}><img src={d.url} alt={"Design option "+(i+1)}/><strong>{rtl?"النموذج":"Option"} {i+1}</strong><button type="button" className="subtle-button" onClick={()=>{setChosenDesign(d);setMediaFile(null)}}>{chosenDesign?.id===d.id?t.chosen:t.chooseDesign}</button></div>)}</div>}</section><div className="gemini-import-help"><p>{rtl?'خيار Gemini المجاني: افتح Gemini، أنشئ الصورة هناك، نزّلها ثم ارفعها هنا. لا يحتاج ربط API.':'Free Gemini option: open Gemini, create your image there, download it, then upload it here. No API connection required.'}</p><a className="outline-button" href="https://gemini.google.com/app" target="_blank" rel="noreferrer">{rtl?'فتح Gemini':'Open Gemini'}</a></div><label>{t.media}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime" onChange={e=>{setMediaFile(e.target.files?.[0]||null);setChosenDesign(null)}}/>{mediaFile&&<small className="muted-note">{mediaFile.name} · {(mediaFile.size/1024/1024).toFixed(1)} MB</small>}</label><label>{t.schedule}<input type="datetime-local" value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)}/></label><button className="primary-button" disabled={busy||pages.length===0}><Plus size={16}/>{scheduledFor?t.scheduleBtn:t.draft}</button>{pages.length===0&&<small className="muted-note">{t.noPages}</small>}</form></section><section className="panel"><div className="panel-head"><h3>{t.planner}</h3><Clock3 size={17}/></div>{posts.length===0?<div className="small-empty">{t.empty}</div>:<div className="data-list">{posts.map(p=><div className="data-row" key={p.id}><div className="quick-icon violet"><CalendarDays size={17}/></div><div className="data-main"><strong>{p.caption.slice(0,80)||t.newPost}</strong><small>{p.scheduled_for?new Date(p.scheduled_for).toLocaleString():t.draft}</small></div><span className="status-pill">{p.status==='scheduled'?t.scheduledStatus:t.draftStatus}</span></div>)}</div>}</section></div>}
  {section==='automation'&&<div className="planner-grid"><section className="panel"><div className="panel-head"><h3>{t.rule}</h3><WandSparkles size={18}/></div><form className="module-form" onSubmit={addRule}><label>{t.ruleName}<input value={ruleName} onChange={e=>setRuleName(e.target.value)} required/></label><label>{t.triggerType}<select value={ruleType} onChange={e=>setRuleType(e.target.value as 'comment_keyword'|'incoming_message')}><option value="comment_keyword">{t.commentTrigger}</option><option value="incoming_message">{t.messageTrigger}</option></select></label><label>{t.page}<select value={rulePageId} onChange={e=>setRulePageId(e.target.value)}><option value="">{t.allPages}</option>{pages.map(p=><option key={p.id} value={p.id}>{p.page_name} · {p.platform}</option>)}</select></label><label>{t.keyword}<input value={keyword} onChange={e=>setKeyword(e.target.value)} required/></label><label>{t.replyText}<textarea rows={4} value={replyText} onChange={e=>setReplyText(e.target.value)} required/></label><button className="primary-button" disabled={busy}><Plus size={16}/>{t.add}</button></form></section><section className="panel"><div className="panel-head"><h3>{t.automation}</h3><WandSparkles size={17}/></div>{rules.length===0?<div className="small-empty">{t.empty}</div>:<div className="data-list">{rules.map(rule=><div className="data-row" key={rule.id}><div className="data-main"><strong>{rule.name}</strong><small>{rule.trigger_value||rule.trigger_type} · {rule.reply_text}</small></div><button className={rule.is_enabled?'toggle-button enabled':'toggle-button'} onClick={()=>void toggleRule(rule)}>{rule.is_enabled?t.enabled:t.disabled}</button></div>)}</div>}</section></div>}
  {section==='assistant'&&<section className="panel assistant-panel"><div className="panel-head"><div><h2>{t.assistant}</h2><p>{t.assistantHint}</p></div><Sparkles size={21}/></div><div className="assistant-thread">{assistantMessages.length===0?<div className="small-empty">{t.assistantWelcome}</div>:assistantMessages.map((m,i)=><article className={m.role==='user'?'assistant-message user':'assistant-message'} key={i}><strong>{m.role==='user'?(rtl?'أنت':'You'):(rtl?'المساعد':'Assistant')}</strong><p>{m.content}</p></article>)}{assistantBusy&&<div className="small-empty">{t.assistantThinking}</div>}</div><form className="chat-compose" onSubmit={sendAssistant}><input value={assistantInput} onChange={e=>setAssistantInput(e.target.value)} placeholder={t.assistantPlaceholder} disabled={assistantBusy}/><button className="primary-button" disabled={assistantBusy||!assistantInput.trim()}><Send size={16}/>{t.assistantSend}</button></form></section>}
  {section==='settings'&&<section className="panel module-panel"><div className="module-icon"><CheckCircle2 size={23}/></div><h2>{t.settings}</h2><p>{t.settingsHint}</p></section>}
 </div>
}