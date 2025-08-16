// Cloudflare Pages Function: GoatCounter API 토큰 인증 프록시
// - env.GOATCOUNTER_SITE, env.GOATCOUNTER_TOKEN 환경변수 필요
// - /api/goat-proxy?path=/stats/total 등으로 호출
// - 브라우저 CORS 허용

export async function onRequestGet({ request, env }) {
  const SITE = env.GOATCOUNTER_SITE;
  const TOKEN = env.GOATCOUNTER_TOKEN;
  if (!SITE || !TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing GOATCOUNTER_SITE or GOATCOUNTER_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  const url = new URL(request.url);
  const path = url.searchParams.get('path') || '/stats/total';
  const apiUrl = `https://${SITE}.goatcounter.com/api/v0${path}`;

  const res = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json'
    }
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
