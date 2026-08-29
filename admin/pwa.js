let deferredInstall=null;
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
function installLabel(){return document.documentElement.lang==='en'?'Install Digital Compass':'تثبيت Digital Compass'}
function createInstallButton(){
  if(isStandalone()||document.getElementById('pwaInstallBtn'))return null;
  const b=document.createElement('button');b.id='pwaInstallBtn';b.className='iconBtn pwaInstallBtn';b.textContent=installLabel();b.title=installLabel();
  b.onclick=async()=>{
    if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;b.remove();return}
    if(isIOS())alert(document.documentElement.lang==='en'?'On iPhone/iPad: tap Share, then Add to Home Screen.':'على iPhone/iPad: اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية.');
  };
  const top=document.querySelector('.topActions');
  if(top)top.prepend(b);else{b.style.position='fixed';b.style.zIndex='200';b.style.bottom='18px';b.style.left='18px';document.body.appendChild(b)}
  return b;
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;createInstallButton()});
window.addEventListener('appinstalled',()=>{deferredInstall=null;document.getElementById('pwaInstallBtn')?.remove()});
if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;if(!worker)return;
        worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){
          const n=document.createElement('button');n.className='pwaUpdateNotice';n.textContent=document.documentElement.lang==='en'?'New version ready — Reload':'نسخة جديدة جاهزة — إعادة تحميل';n.onclick=()=>location.reload();document.body.appendChild(n);
        }})
      });
    }catch(e){console.error('PWA registration failed',e)}
    if(isIOS()&&!isStandalone())createInstallButton();
  });
}
new MutationObserver(()=>{const b=document.getElementById('pwaInstallBtn');if(b)b.textContent=installLabel()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});