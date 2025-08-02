const fs = require('fs');
const path = require('path');
const os = require('os');  // 추가

const DOMAIN = 'https://www.planearth.co.kr';
// 임시 폴더 내 dist 경로로 변경
const DIST_DIR = path.join(__dirname, '..'); // HTML은 루트에 있으니까!
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml'); // 루트에 바로 저장

console.log('✅ sitemap 생성 대상 경로:', SITEMAP_PATH);

function generateSitemap() {
  // public 폴더 없으면 생성 해보자
  fs.mkdirSync(path.dirname(SITEMAP_PATH), { recursive: true });

  // 기존 sitemap 삭제
  if (fs.existsSync(SITEMAP_PATH)) {
    fs.unlinkSync(SITEMAP_PATH);
    console.log('🗑️ 기존 sitemap.xml 삭제 완료');
  }

  // dist 폴더가 존재하지 않으면 에러 방지용 처리
  if (!fs.existsSync(DIST_DIR)) {
console.error(`❌ 대상 폴더가 존재하지 않습니다: ${DIST_DIR}`);
    return;
  }

  const files = fs.readdirSync(DIST_DIR).filter(f => /^[0-9]{4}-.+\.html$/.test(f));

  const dynamicUrls = files.map(filename => ({
    loc: `${DOMAIN}/${filename}`,
    priority: '0.6',
  }));

  const staticUrls = [
    { loc: `${DOMAIN}/`, priority: '1.0' },
    { loc: `${DOMAIN}/works`, priority: '0.8' },
    { loc: `${DOMAIN}/workshop`, priority: '0.8' }
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
