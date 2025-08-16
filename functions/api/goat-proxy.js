// Cloudflare Pages Function: /api/goat-proxy
// - env.GOATCOUNTER_SITE  : 예) "jmlee710000"   (일반 텍스트 변수)
// - env.GOATCOUNTER_TOKEN : GoatCounter API 토큰(시크릿)
// - 프런트에서 /api/goat-proxy?path=/stats/total?start=YYYY-MM-DD&end=YYYY-MM-DD 로 호출

export async function onRequestGet({ request, env }) {
  const site  = env.GOATCOUNTER_SITE;
  const token = env.GOATCOUNTER_TOKEN;

  if (!site || !token) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing GOATCOUNTER_SITE or GOATCOUNTER_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const url = new URL(request.url);
  // URLSearchParams.get()는 자동 디코드됨 (프런트에서 encodeURIComponent로 넘겨도 OK)
  let path = url.searchParams.get('path') || '/stats/total';
  if (!path.startsWith('/')) path = '/' + path;

  // 보안: /stats/ 엔드포인트만 허용
  if (!/^\/stats\/[a-z0-9/_-]+/i.test(path)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden path' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 최종 업스트림 URL (v0 API)
  const upstream = `https://${site}.goatcounter.com/api/v0${path}`;

  const res = await fetch(upstream, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const body = await res.text(); // 그대로 중계
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}
