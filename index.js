const express = require('express');
const { spawnSync } = require('child_process'); // exec 대신 spawnSync!
const app = express();
const fs = require('fs');
const path = require('path');

// sitemap.xml 직접 서빙 라우트
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    return res.status(404).send('❌ sitemap.xml 없음!');
  }
  const xml = fs.readFileSync(sitemapPath, 'utf-8');
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// 자동 생성 라우트 (spawnSync로 변경!)
app.get('/generate', (req, res) => {
  const htmlGen = spawnSync('node', ['js/generateHtml.js'], { encoding: 'utf-8' });
  if (htmlGen.error) {
    console.error('❌ HTML 생성 실패:', htmlGen.error);
    return res.status(500).send('HTML 생성 실패!');
  }
  console.log('✅ HTML 생성 출력:', htmlGen.stdout);

  const sitemapGen = spawnSync('node', ['js/generateSitemap.js'], { encoding: 'utf-8' });
  if (sitemapGen.error) {
    console.error('❌ 사이트맵 생성 실패:', sitemapGen.error);
    return res.status(500).send('사이트맵 생성 실패!');
  }
  console.log('✅ 사이트맵 생성 출력:', sitemapGen.stdout);

  res.send('🎉 HTML + 사이트맵 생성 완료!');
});

// 기본 루트
app.get('/', (req, res) => {
  res.send('🟢 HTML & Sitemap Generator Server 작동 중');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중! 포트: ${PORT}`);
});
