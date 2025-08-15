// Cloudflare Pages Functions: /functions/r2-upload.js
// FormData(file, workId, slug, kind='cover'|'gallery', index?) 받아 R2에 저장하고 퍼블릭 URL 반환

export const onRequest = async ({ request, env }) => {
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
  if (request.method !== 'POST')   return cors(json({ error: 'POST only' }, 405), origin);

  try {
    const form  = await request.formData();
    const file  = form.get('file');
    const workId = String(form.get('workId') || '').trim();
    const slug   = String(form.get('slug')   || '').trim();
    const kind   = String(form.get('kind')   || 'cover'); // 'cover' | 'gallery'
    const index  = Number(form.get('index')  || 0);       // gallery는 1부터

    if (!file)   return cors(json({ error: 'file 누락' }, 400), origin);
    if (!workId) return cors(json({ error: 'workId 누락' }, 400), origin);
    if (!slug)   return cors(json({ error: 'slug 누락' }, 400), origin);
    if (kind !== 'cover' && kind !== 'gallery') {
      return cors(json({ error: 'kind 값은 cover|gallery' }, 400), origin);
    }

    const ext  = extFromFile(file) || 'jpg';
    const mime = contentTypeFromExt(ext);

    // workId 패딩 (4자리 이상 자동 확장)
    const padWidth = Math.max(4, String(workId).length);
    const idp      = String(workId).padStart(padWidth, '0');

    const name = (kind === 'cover')
      ? `${idp}_${slug}.${ext}`
      : `${idp}_${slug}${index}.${ext}`;

    const path = (kind === 'cover') ? `works/${name}` : `images/${name}`;

    await env.BUCKET.put(path, file.stream(), { httpMetadata: { contentType: mime } });

    // ⚠️ R2_PUBLIC_URL = "https://object.planearth.co.kr" (뒤에 /works 붙이면 안됨)
    const url = joinUrl(env.R2_PUBLIC_URL, path);
    return cors(json({ url, path }), origin);
  } catch (e) {
    return cors(json({ error: e?.message || 'upload fail' }, 500), origin);
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
function extFromFile(file) {
  const n = (file.name || '').toLowerCase();
  const m = n.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i);
  if (m) return (m[1] === 'jpeg' ? 'jpg' : m[1]).toLowerCase();
  const t = (file.type || '').toLowerCase();
  if (t.includes('jpeg')) return 'jpg';
  if (t.includes('png'))  return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif'))  return 'gif';
  if (t.includes('avif')) return 'avif';
  return null;
}
function contentTypeFromExt(ext) {
  switch (ext) {
    case 'jpg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'avif': return 'image/avif';
    default: return 'application/octet-stream';
  }
}
function joinUrl(prefix, path) {
  return `${String(prefix || '').replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
}
