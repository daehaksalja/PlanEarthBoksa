// Cloudflare Pages Function: GoatCounter 토큰 인증 프록시
// 환경변수 필요: GOATCOUNTER_SITE, GOATCOUNTER_TOKEN
// 사용 예) /api/goat-proxy?path=/stats/total&start=2025-08-01&end=2025-08-17

export async function onRequestGet({ request, env }) {
  const site  = env.GOATCOUNTER_SITE;   // 예: "jmlee710000"
  const token = env.GOATCOUNTER_TOKEN;  // GoatCounter > API 에서 발급한 토큰

  if (!site || !token) {
    return new Response(JSON.stringify({ ok: false, error: 'missing GOATCOUNTER_SITE or GOATCOUNTER_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const url  = new URL(request.url);
  const path = url.searchParams.get('path') || '';

  // 안전장치: stats 하위만 허용 (필요시 추가)
  const allowed = ['/stats/total', '/stats/hits', '/stats/referrers', '/stats/countries'];
  if (!allowed.some(p => path.startsWith(p))) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // path 제외 나머지 쿼리는 그대로 전달
  const fwd = new URLSearchParams(url.search);
  fwd.delete('path');
  const qs = fwd.toString();

  const upstream = `https://${site}.goatcounter.com/api/v0${path}${qs ? `?${qs}` : ''}`;

  const res = await fetch(upstream, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  });

  const body = await res.text(); // 그대로 중계
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    }
  });
}
