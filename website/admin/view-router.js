const allowed=new Set(['overview','leads','prototypes','outreach','automation','settings']);
const target=new URLSearchParams(location.search).get('view');
if(target&&allowed.has(target)){
  const tryOpen=()=>{
    const app=document.querySelector('#appView:not(.hidden)');
    const button=document.querySelector(`.navItem[data-view="${target}"]`);
    if(app&&button){button.click();return true}
    return false;
  };
  if(!tryOpen()){
    let attempts=0;
    const timer=setInterval(()=>{attempts++;if(tryOpen()||attempts>80)clearInterval(timer)},100);
  }
}
