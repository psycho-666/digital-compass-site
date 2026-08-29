const CACHE='dc-admin-shell-v2';
const SHELL=['./','./admin.css','./admin-extra.css','./assistant-ui.css','./admin.js','./view-router.js','./assistant-ui.js','./push-ui.js','../assets/digital-compass-logo.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname.includes('/functions/')||url.pathname.includes('/rest/')||url.pathname.includes('/auth/')) return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('./')));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
    return res;
  })));
});
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||'مطلوب إجراء منك'}}
  const title=data.title||'Digital Compass';
  const options={body:data.body||'مطلوب إجراء منك',tag:`dc-notification-${data.notification_id||Date.now()}`,renotify:true,data:{action_path:data.action_path||'./',notification_id:data.notification_id||null,approval_request_id:data.approval_request_id||null,severity:data.severity||'ACTION_REQUIRED'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const raw=event.notification.data?.action_path||'./';
  const target=new URL(raw,self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    for(const client of clients){if(client.url.startsWith(self.registration.scope)){try{await client.navigate(target)}catch{}return client.focus()}}
    return self.clients.openWindow(target);
  }));
});