// functions/api/goat-proxy.js
// GoatCounter 토큰 프록시 (Cloudflare Pages Functions)
// 필요 env: GOATCOUNTER_SITE, GOATCOUNTER_TOKEN

export async function onRequestGet({ request, env }) {
  try {
    const site  = env.GOATCOUNTER_SITE;      // 예: jmlee710000
    const token = env.GOATCOUNTER_TOKEN;     // GoatCounter > Settings > API 에서 발급
    if (!site || !token) {
      return json({ ok: false, error: 'missing env: GOATCOUNTER_SITE / GOATCOUNTER_TOKEN' }, 500);
    }

    const url   = new URL(request.url);
    const pathQ = url.searchParams.get('path') || '';     // 예: /api/v0/stats/total?from=...&to=...
    const [pathname, q = ''] = pathQ.split('?');
    const qs = q ? `?${q}` : '';

    // ── 화이트리스트 (경로만 검사; 쿼리는 위에서 분리)
    const ALLOW_PREFIXES = [
      '/api/v0/stats/',     // total, hits, referrers, countries, cities, browsers, systems ...
      // 필요 시 추가: '/api/v0/hits', '/api/v0/referrers' 등
    ];
    if (!ALLOW_PREFIXES.some(p => pathname.startsWith(p))) {
      return json({ ok: false, error: 'forbidden path' }, 400);
    }

    const upstream = `https://${site}.goatcounter.com${pathname}${qs}`;
    const r = await fetch(upstream, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    const body = await r.text(); // 그대로 중계
    return new Response(body, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
