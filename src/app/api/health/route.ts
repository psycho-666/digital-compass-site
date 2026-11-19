import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, database: "not_configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("social_health_check");

  if (error || !data?.ok) {
    return NextResponse.json(
      { ok: false, database: "error", message: error?.message ?? "Health check failed" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, database: "connected", edition: "social" });
}
