const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

// 1. public 폴더 정적 파일 서빙 설정
app.use(express.static(path.join(__dirname, 'public')));

// 2. sitemap.xml 직접 서빙 (정적 서빙 실패 대비)
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    return res.status(404).send('sitemap.xml 없음');
  }
  const xml = fs.readFileSync(sitemapPath, 'utf-8');
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// 3. /generate 라우트: generateHtml.js 실행 후 generateSitemap.js 실행
app.get('/generate', (req, res) => {
  const execOptions = { cwd: __dirname };

  const nodePath = process.execPath;
  const generateHtmlPath = path.join(__dirname, 'js', 'generateHtml.js');
  const generateSitemapPath = path.join(__dirname, 'js', 'generateSitemap.js');

  exec(`"${nodePath}" "${generateHtmlPath}"`, execOptions, (err, stdout, stderr) => {
    console.log('generateHtml.js 실행 시작');
    if (err) {
      console.error('❌ HTML 생성 실패:', err);
      return res.status(500).send('HTML 생성 실패!');
    }
    if (stderr) {
      console.error('⚠️ HTML 생성 경고:', stderr);
    }
    console.log('✅ HTML 생성 성공 출력:', stdout);

    exec(`"${nodePath}" "${generateSitemapPath}"`, execOptions, (err2, stdout2, stderr2) => {
      if (err2) {
        console.error('❌ 사이트맵 생성 실패:', err2);
        return res.status(500).send('사이트맵 생성 실패!');
      }
      if (stderr2) {
        console.error('⚠️ 사이트맵 생성 경고:', stderr2);
      }
      console.log('✅ 사이트맵 생성 성공 출력:', stdout2);

      res.send('🎉 HTML + 사이트맵 생성 완료!');
    });
  });
});

// 4. 기본 루트 테스트
app.get('/', (req, res) => {
  res.send('🟢 HTML & Sitemap Generator Server 작동 중');
});

// 5. 서버 시작
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중! 포트: ${PORT}`);
});
