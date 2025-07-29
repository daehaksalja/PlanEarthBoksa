const fs = require('fs');
const path = require('path');
const os = require('os');  // 추가

const DOMAIN = 'https://www.moongsoon.xyz';
// 임시 폴더 내 dist 경로로 변경
const DIST_DIR = path.join(os.tmpdir(), 'dist');  // /tmp/dist (윈도우는 %TEMP%)
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');

console.log('✅ sitemap 생성 대상 경로:', SITEMAP_PATH);

function generateSitemap() {
  // public 폴더 없으면 생성
  fs.mkdirSync(path.dirname(SITEMAP_PATH), { recursive: true });

  // 기존 sitemap 삭제
  if (fs.existsSync(SITEMAP_PATH)) {
    fs.unlinkSync(SITEMAP_PATH);
    console.log('🗑️ 기존 sitemap.xml 삭제 완료');
  }

  // dist 폴더가 존재하지 않으면 에러 방지용 처리
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ dist 폴더가 존재하지 않습니다: ${DIST_DIR}`);
    return;
  }

  const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.html'));
  const dynamicUrls = files.map(filename => ({
    loc: `${DOMAIN}/works/${filename}`,
    priority: '0.6',
  }));

  const staticUrls = [
    { loc: `${DOMAIN}/`, priority: '1.0' },
    { loc: `${DOMAIN}/works`, priority: '0.8' },
    { loc: `${DOMAIN}/workshop`, priority: '0.8' },
    { loc: `${DOMAIN}/works-detail`, priority: '0.7' },
  ];

  const allUrls = [...staticUrls, ...dynamicUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, xml);
  console.log('🗺️ sitemap.xml 생성 완료!');
}

generateSitemap();
