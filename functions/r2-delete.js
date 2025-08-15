// Cloudflare Pages Functions: /functions/r2-delete.js
// body: { urls?: string[], paths?: string[] } -> R2 객체 삭제
export const onRequest = async ({ request, env }) => {
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
  if (request.method !== 'POST')   return cors(json({ error: 'POST only' }, 405), origin);

  try {
    const body = await request.json();
    const urls  = Array.isArray(body?.urls)  ? body.urls  : [];
    const paths = Array.isArray(body?.paths) ? body.paths : [];

    const toDelete = new Set();

    // 1) 풀 URL → pathname만 추출 (예: /works/0001_xxx.jpg)
    for (const u of urls) {
      if (!u) continue;
      const key = urlToKey(u);      // => works/0001_xxx.jpg
      if (key) toDelete.add(key);
    }

    // 2) 이미 키(상대경로)로 들어온 경우도 처리
    for (const p of paths) {
      if (!p) continue;
      toDelete.add(String(p).replace(/^\/+/, '')); // 앞의 / 제거
    }

    const deleted = [];
    for (const key of toDelete) {
      // 존재여부 체크(선택) → 통계에 포함
      const head = await env.BUCKET.head(key);
      await env.BUCKET.delete(key);
      deleted.push({ key, existed: !!head });
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
function urlToKey(u) {
  try {
    // http(s)://... 인 경우
    if (/^https?:\/\//i.test(u)) {
      const { pathname } = new URL(u);
      return decodeURIComponent(pathname.replace(/^\/+/, '')); // => works/..., images/...
    }
    // 이미 키인 경우
    return String(u).replace(/^\/+/, '');
  } catch {
    return String(u).replace(/^\/+/, '');
  }
}
