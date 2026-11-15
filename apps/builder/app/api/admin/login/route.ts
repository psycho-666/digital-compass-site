import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const expectedUsername = process.env.BUILDER_ADMIN_USERNAME;
    const expectedPassword = process.env.BUILDER_ADMIN_PASSWORD;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!expectedUsername || !expectedPassword || !url || !serviceKey) {
      return NextResponse.json(
        { error: "إعداد دخول المدير غير مكتمل. يلزم إضافة مفاتيح الإدارة الآمنة إلى إعدادات النشر." },
        { status: 503 },
      );
    }

    if (typeof username !== "string" || typeof password !== "string" ||
        username !== expectedUsername || password !== expectedPassword) {
      return NextResponse.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." }, { status: 401 });
    }

    const admin = createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = "admin@digitalcompass.local";
    const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;

    const existing = users.users.find((user) => user.email?.toLowerCase() === email);
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        app_metadata: { ...existing.app_metadata, role: "admin", provider: "email" },
      });
      if (error) throw error;
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: "admin", provider: "email" },
        user_metadata: { full_name: "Digital Compass Administrator" },
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error("Builder admin login failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر إكمال تسجيل دخول المدير." },
      { status: 500 },
    );
  }
}
