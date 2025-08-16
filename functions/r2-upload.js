// /r2-upload  (POST)
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
    const form = await request.formData();
    const file  = form.get('file');
    const workId = String(form.get('workId') ?? '');
    const slug   = String(form.get('slug') ?? 'untitled');
    const kind   = String(form.get('kind') ?? 'cover'); // 'cover' | 'gallery'
    const seq    = form.get('seq') ? String(form.get('seq')) : null;

    if (!file)   return json({ error: 'file required' }, 400);
    if (!workId) return json({ error: 'workId required' }, 400);

    const key = (kind === 'gallery' && seq)
      ? `images/${workId}/${seq}_${slug}.jpg`
      : `works/${workId}/cover_${slug}.jpg`;

    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    });

    const base = env.R2_PUBLIC_BASE; // 예: https://object.planearth.co.kr/planearth
    return json({ url: `${base}/${key}` });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', ...CORS }
  });
}
