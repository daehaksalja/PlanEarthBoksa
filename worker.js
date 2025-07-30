const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 개발용
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS 프리플라이트(OPTIONS) 응답 추가!
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/login-auth' && request.method === 'POST') {
      const { email, password } = await request.json();

      if (email === 'admin@planearth.com' && password === '1234') {
        return new Response('로그인 성공!', { status: 200, headers: corsHeaders });
      } else {
        return new Response('로그인 실패!', { status: 401, headers: corsHeaders });
      }
    }

    return new Response('404 Not Found', { status: 404, headers: corsHeaders });
  }
}
