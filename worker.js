// 🔥 완전 Workers 스타일로 다시 작성한 worker.js 예시
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/login-auth' && request.method === 'POST') {
      const { email, password } = await request.json();

      // 예시: 이메일/비번 하드코딩 비교
      if (email === 'admin@planearth.com' && password === '1234') {
        return new Response('로그인 성공!', { status: 200 });
      } else {
        return new Response('로그인 실패!', { status: 401 });
      }
    }

    return new Response('404 Not Found', { status: 404 });
  }
}
