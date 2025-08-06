const SUPABASE_URL = "https://feprvneoartflrnmefxz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("로그인 실패다!" + error.message);
      return;
    }

    // 로그인 성공 시 관리자 대시보드로 이동
    window.location.href = "admin-dashboard.html";
  } catch (err) {
    alert('로그인 처리 중 오류가 발생했습니다.');
  }
});
