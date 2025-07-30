// login.js
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('https://login.jmlee710000.workers.dev/login-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await res.text();
    alert(result); // 결과 메시지를 화면에 표시
  } catch (error) {
    alert('로그인 처리 중 오류가 발생했습니다.');
  }
});
