function v5Name(data){
  const id=Number(data.company?.id||data.company_id||0),raw=String(data.company?.name||'').toLowerCase();
  let key=id;
  if(!V5_NAMES[key]){
    if(raw.includes('المجر')||raw.includes('majer')||raw.includes('majar')) key=4373;
    else if(raw.includes('الرحمن')||raw.includes('الياقوت')||raw.includes('rahman')||raw.includes('yaqout')) key=4499;
    else if(raw.includes('magic paint')) key=4556;
  }
  return V5_NAMES[key]?.[LANG]||data.company?.name||'';
}
