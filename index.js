const express = require('express');
const { exec } = require('child_process');
const app = express();

// 자동 생성 라우트
app.get('/generate', (req, res) => {
  exec('node js/generateHtml.js', (err) => {
    if (err) {
      console.error('❌ HTML 생성 실패:', err);
      return res.status(500).send('HTML 생성 실패!');
    }

    exec('node js/generateSitemap.js', (err2) => {
      if (err2) {
        console.error('❌ 사이트맵 생성 실패:', err2);
        return res.status(500).send('사이트맵 생성 실패!');
      }

      res.send('🎉 HTML + 사이트맵 생성 완료!');
    });
  });
});

// 기본 루트 테스트
app.get('/', (req, res) => {
  res.send('🟢 HTML & Sitemap Generator Server 작동 중');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중! 포트: ${PORT}`);
});
