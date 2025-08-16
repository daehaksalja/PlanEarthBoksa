// functions/deploy.js
export const onRequestOptions = () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }
  });

export const onRequestPost = async ({ env /*, request */ }) => {
  try {
    // (선택) 세션 검증 로직 추가 가능
    const r = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
    if (!r.ok) throw new Error('deploy hook failed');
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};
