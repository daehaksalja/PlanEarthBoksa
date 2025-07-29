const fs = require('fs');
const path = require('path');

const DOMAIN = 'http://www.planearth.co.kr'; // 실 주소로 바꿔줘
const DIST_DIR = path.join(__dirname, '..', 'dist');

const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

function generateSitemap() {
  // 고정 페이지들
  const staticUrls = [
    { loc: `${DOMAIN}/`, priority: '1.0' },
    { loc: `${DOMAIN}/works`, priority: '0.8' },
    { loc: `${DOMAIN}/workshop`, priority: '0.8' },
    { loc: `${DOMAIN}/works-detail`, priority: '0.7' },
  ];

  // 명함용 정적 HTML들
  const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.html'));
  const dynamicUrls = files.map(filename => ({
    loc: `${DOMAIN}/works/${filename}`,
    priority: '0.6',
  }));

  const allUrls = [...staticUrls, ...dynamicUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, xml);
  console.log('🗺️ sitemap.xml 생성 완료!');
}

generateSitemap();
