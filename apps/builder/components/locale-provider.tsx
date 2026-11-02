"use client";
import {createContext,useContext,useEffect,useMemo,useState} from "react";
type Locale="ar"|"en";
const LocaleContext=createContext<{locale:Locale;setLocale:(value:Locale)=>void}>({locale:"ar",setLocale:()=>{}});
export function LocaleProvider({children}:{children:React.ReactNode}){
 const [locale,setLocaleState]=useState<Locale>("ar");
 useEffect(()=>{const saved=window.localStorage.getItem("dc-builder-locale");if(saved==="en"||saved==="ar")setLocaleState(saved);},[]);
 const setLocale=(value:Locale)=>{setLocaleState(value);window.localStorage.setItem("dc-builder-locale",value);};
 useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir=locale==="ar"?"rtl":"ltr";},[locale]);
 const value=useMemo(()=>({locale,setLocale}),[locale]);
 return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale(){return useContext(LocaleContext);}
export function LanguageSwitch(){const {locale,setLocale}=useLocale();return <button type="button" className="language-switch" onClick={()=>setLocale(locale==="ar"?"en":"ar")} aria-label={locale==="ar"?"Switch to English":"التبديل إلى العربية"}>{locale==="ar"?"EN":"عربي"}</button>;}
