const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://www.planearth.co.kr';
const DIST_DIR = path.join(__dirname, '..');          // HTML 루트
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');

console.log('✅ sitemap 생성 대상 경로:', SITEMAP_PATH);

function isoDate(ts) {
  return new Date(ts).toISOString();
}

function generateSitemap() {
  fs.mkdirSync(path.dirname(SITEMAP_PATH), { recursive: true });

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ 대상 폴더가 존재하지 않습니다: ${DIST_DIR}`);
    return;
  }

  // 0001-...html 만 수집 + 이름 정렬
  const files = fs.readdirSync(DIST_DIR)
    .filter(f => /^[0-9]{4}-.+\.html$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const dynamicUrls = files.map(filename => {
    const full = path.join(DIST_DIR, filename);
    const stat = fs.statSync(full);
    return {
      loc: `${DOMAIN}/${filename}`,
      priority: '0.6',
      lastmod: isoDate(stat.mtimeMs),
    };
  });

  // 실제 존재 확인(안 존재하면 주석 처리하거나 제거)
  const staticCandidates = [
    { loc: `${DOMAIN}/`, priority: '1.0' },
    { loc: `${DOMAIN}/works.html`, priority: '0.8' },
    { loc: `${DOMAIN}/workshop.html`, priority: '0.8' },
  ];
  const staticUrls = staticCandidates.filter(u => {
    // 루트('/')는 패스, 나머지는 파일 존재 체크
    if (u.loc.endsWith('/')) return true;
    const fname = u.loc.replace(`${DOMAIN}/`, '');
    return fs.existsSync(path.join(DIST_DIR, fname));
  });

  const allUrls = [...staticUrls, ...dynamicUrls];

  const body = allUrls.map(u => {
    const last = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>${last}\n  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  fs.writeFileSync(SITEMAP_PATH, xml, { encoding: 'utf8' }); // ✅ BOM 없음
  console.log('🗺️ sitemap.xml 생성 완료!');
}

generateSitemap();
