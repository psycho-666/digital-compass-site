import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
export async function GET() {
 if (!isSupabaseConfigured()) return NextResponse.json({ok:false,database:"not_configured"},{status:503});
 const supabase = await createClient();
 const {error} = await supabase.from("platform_integrations").select("platform").limit(1);
 if (error) return NextResponse.json({ok:false,database:"error",message:error.message},{status:503});
 return NextResponse.json({ok:true,database:"connected",edition:"social"});
}
