// Cloudflare Pages Function: GoatCounter API 토큰 인증 프록시
// 호출 예: /api/goat-proxy?path=/stats/total  또는 /api/goat-proxy?path=/stats/hits&limit=50
// 필요 환경변수:
//  - GOATCOUNTER_SITE   (예: "jmlee710000")   ← 일반 텍스트
//  - GOATCOUNTER_TOKEN  (API 토큰)            ← 비밀

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  try {
    const SITE  = env.GOATCOUNTER_SITE;
    const TOKEN = env.GOATCOUNTER_TOKEN;

    if (!SITE || !TOKEN) {
      return json({ ok: false, error: 'Missing GOATCOUNTER_SITE or GOATCOUNTER_TOKEN' }, 500);
    }

    const url  = new URL(request.url);
    const path = (url.searchParams.get('path') || '/stats/total').trim();

    // ---- 경로 정규화 --------------------------------------------------------
    let p = path.startsWith('/') ? path : '/' + path;
    // 사용자가 /api/v0/… 를 넘겨도 중복되지 않게 제거
    if (p.startsWith('/api/v0/')) p = p.slice('/api/v0'.length);

    // 화이트리스트: stats API만 허용
    if (!/^\/stats\//.test(p)) {
      return json({ ok: false, error: 'forbidden path (only /stats/* allowed)' }, 400);
    }

    // path= 외의 다른 쿼리스트링 유지
    const upstreamQS = new URLSearchParams(url.search);
    upstreamQS.delete('path');
    const qs = upstreamQS.toString();
    const upstreamUrl = `https://${SITE}.goatcounter.com/api/v0${p}${qs ? `?${qs}` : ''}`;

    const r = await fetch(upstreamUrl, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const text = await r.text();
    // 그대로 전달하되 CORS/캐시 헤더 보강
    return new Response(text, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...CORS
      }
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}
