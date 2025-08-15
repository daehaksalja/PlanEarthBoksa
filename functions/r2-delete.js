export const onRequest = async ({ request, env }) => {
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
  if (request.method !== 'POST')   return cors(json({ error: 'POST only' }, 405), origin);

  try {
    const body = await request.json();
    const paths = body?.paths ?? [];
    const urls  = body?.urls  ?? [];

    const root = (env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
    const toDelete = new Set();

    for (const p of paths) if (p) toDelete.add(p.replace(/^\/+/, ''));
    for (const u of urls) {
      if (!u) continue;
      const rel = u.replace(root, '').replace(/^\/+/, '');
      if (rel) toDelete.add(rel);
    }

    const deleted = [];
    for (const p of toDelete) {
      await env.BUCKET.delete(p);
      deleted.push({ path: p, ok: true });
    }
    return cors(json({ deleted }), origin);
  } catch (e) {
    return cors(json({ error: e?.message || 'delete fail' }, 500), origin);
  }
};

/* helpers */
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
function cors(res, origin) {
  const h = new Headers(res.headers);
  if (origin) h.set('Access-Control-Allow-Origin', origin);
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(res.body, { status: res.status, headers: h });
}
