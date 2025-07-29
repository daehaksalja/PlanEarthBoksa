const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

// 정적 파일 서빙 설정
app.use(express.static(path.join(__dirname, 'public')));

// sitemap.xml 직접 서빙
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    return res.status(404).send('sitemap.xml 없음');
  }
  const xml = fs.readFileSync(sitemapPath, 'utf-8');
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// 자동 생성 라우트
app.get('/generate', (req, res) => {
  exec('node js/generateHtml.js', (err, stdout, stderr) => {
    if (err) {
      console.error('❌ HTML 생성 실패:', err);
      return res.status(500).send('HTML 생성 실패!');
    }
    console.log('📤 HTML 생성 출력:', stdout);
    if (stderr) console.error('⚠️ HTML 생성 경고:', stderr);

    exec('node js/generateSitemap.js', (err2, stdout2, stderr2) => {
      if (err2) {
        console.error('❌ 사이트맵 생성 실패:', err2);
        return res.status(500).send('사이트맵 생성 실패!');
      }
      console.log('📤 사이트맵 생성 출력:', stdout2);
      if (stderr2) console.error('⚠️ 사이트맵 생성 경고:', stderr2);

      res.send('🎉 HTML + 사이트맵 생성 완료!');
    });
  });
});

// 기본 루트
app.get('/', (req, res) => {
  res.send('🟢 HTML & Sitemap Generator Server 작동 중');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중! 포트: ${PORT}`);
});
