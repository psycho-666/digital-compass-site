"use client";
import type {ChangeEvent} from "react";

export type BuilderSiteOption={id:string;name:string;slug:string};

export function BuilderSitePicker({sites,siteId,locale}:{sites:BuilderSiteOption[];siteId:string;locale:string}){
 if(sites.length<2)return null;
 const ar=locale==="ar";
 function change(event:ChangeEvent<HTMLSelectElement>){
  const next=event.target.value;
  if(next)window.location.assign(window.location.pathname+"?site="+encodeURIComponent(next));
 }
 return <div style={{maxWidth:1120,margin:"0 auto 18px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
  <label htmlFor="builder-site-picker" style={{fontSize:13,fontWeight:700}}>{ar?"الموقع الحالي":"Current website"}</label>
  <select id="builder-site-picker" value={siteId} onChange={change} style={{minWidth:220,maxWidth:"100%",padding:"9px 12px",border:"1px solid #d9d1df",borderRadius:9,background:"#fff",color:"#241b2b"}}>
   <option value="">{ar?"اختر موقعاً":"Choose a website"}</option>
   {sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}
  </select>
 </div>;
}
