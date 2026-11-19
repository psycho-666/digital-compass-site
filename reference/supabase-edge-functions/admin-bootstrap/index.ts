const PROJECT_URL = Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const SECRET_KEY = SECRET_KEYS['default'];
const APPROVED_EMAIL = (Deno.env.get('ADMIN_OWNER_EMAIL') || 'hayderjaafar0@gmail.com').trim().toLowerCase();

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

async function rest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', SECRET_KEY);
  headers.set('Authorization', `Bearer ${SECRET_KEY}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const r = await fetch(`${PROJECT_URL}/rest/v1/${path}`, { ...init, headers });
  if (!r.ok) throw new Error(`rest_${r.status}`);
  return r;
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(authorization)) return null;
  const r = await fetch(`${PROJECT_URL}/auth/v1/user`, {
    headers: { apikey: SECRET_KEY, Authorization: authorization },
  });
  if (!r.ok) return null;
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const user = await authenticatedUser(req);
    if (!user?.id || !user?.email) return json({ error: 'session_invalid' }, 401);

    const body = await req.json().catch(() => ({}));
    if (String(body.action || '') !== 'finalize_owner') return json({ error: 'invalid_action' }, 400);

    const email = String(user.email).trim().toLowerCase();
    if (email !== APPROVED_EMAIL) return json({ error: 'email_not_authorized' }, 403);
    if (!user.email_confirmed_at && !user.confirmed_at) return json({ error: 'email_not_verified' }, 403);

    const admins = await (await rest('admin_users?select=user_id,email&limit=10')).json();
    const current = admins.find((x: { user_id: string }) => x.user_id === user.id);
    if (current) return json({ ok: true, already_initialized: true, email });
    if (admins.length) return json({ error: 'already_initialized' }, 409);

    await rest('admin_users', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: user.id, email }),
    });

    return json({ ok: true, initialized: true, email }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: 'bootstrap_unavailable' }, 503);
  }
});
