import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function createClient() {
 const store=await cookies(), url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) throw new Error("Supabase environment variables are missing.");
 return createServerClient(url,key,{cookies:{getAll:()=>store.getAll(),setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options));}catch{/* Server Components cannot write cookies; middleware refreshes sessions. */}}}});
}