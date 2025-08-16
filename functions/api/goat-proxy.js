// Cloudflare Pages Function: /api/goat-proxy
// - env.GOATCOUNTER_SITE, env.GOATCOUNTER_TOKEN 필요
// - 허용 경로: /stats/*  (보안상 /api/v0/* 차단)
// - 브라우저 CORS 허용

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  try {
    const site = env.GOATCOUNTER_SITE;
    const token = env.GOATCOUNTER_TOKEN;

    if (!site || !token) {
      return json({ ok: false, error: 'missing GOATCOUNTER_SITE or GOATCOUNTER_TOKEN' }, 500);
    }

    const url = new URL(request.url);
    const raw = url.searchParams.get('path') || '/stats/total';

    // path 정규화
    const path = raw.startsWith('/') ? raw : `/${raw}`;

    // 보안 가드: /stats/* 만 허용 (예: /stats/total?start=...&end=...)
    if (!path.startsWith('/stats/')) {
      return json({ ok: false, error: 'forbidden path' }, 400);
    }

    const upstream = `https://${site}.goatcounter.com${path}`;

    const r = await fetch(upstream, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const body = await r.text();

    // 그대로 중계
    return new Response(body, {
      status: r.status,
      headers: {
        ...CORS,
        'Content-Type': r.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
