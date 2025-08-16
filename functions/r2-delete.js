// /r2-delete  (POST)
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const urls  = Array.isArray(body.urls)  ? body.urls  : [];
    const paths = Array.isArray(body.paths) ? body.paths : [];

    const urlKeys = urls
      .map(u => { try { return new URL(u).pathname.replace(/^\//, ''); } catch { return null; } })
      .filter(Boolean);

    const keys = [...paths, ...urlKeys];
    for (const k of keys) await env.BUCKET.delete(k);

    return json({ ok: true, deleted: keys.length });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', ...CORS }
  });
}
