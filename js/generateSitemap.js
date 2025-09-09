// build-sitemap.js — pretty URL 버전 (춘식이 에디션)
const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://www.planearth.co.kr';
const DIST_DIR = path.join(__dirname, '..');          // HTML 루트
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');

function isoDate(ts) {
  return new Date(ts).toISOString();
}

// 파일명 → slug 변환: "0001-foo.html" -> "0001-foo"
function slugify(file) {
  return file.replace(/\.html$/i, '');
}

function generateSitemap() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ 대상 폴더가 존재하지 않습니다: ${DIST_DIR}`);
    process.exit(1);
  }

  // 프로젝트 상세들: 0001-....html 형식만 수집
  const files = fs.readdirSync(DIST_DIR)
    .filter(f => /^\d{4,}-.+\.html$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const dynamicUrls = files.map(filename => {
    const full = path.join(DIST_DIR, filename);
    const stat = fs.statSync(full);
    const slug = slugify(filename);             // 확장자 제거
    return {
      loc: `${DOMAIN}/${slug}`,
      priority: '0.6',
      lastmod: isoDate(stat.mtimeMs),
    };
  });

  // 정적 페이지들(.html → 예쁜 URL로 교체)
  const staticCandidates = [
    { path: '/', priority: '1.0' },            // 루트
    { path: '/works', priority: '0.8', file: 'works.html' },
    { path: '/workshop', priority: '0.8', file: 'workshop.html' },
  ];

  const staticUrls = staticCandidates
    .filter(u => {
      if (u.path === '/') return true;
      // 실제 파일 존재 확인 (배포 폴더에 .html 있어야 함)
      return fs.existsSync(path.join(DIST_DIR, u.file || ''));
    })
    .map(u => ({
      loc: `${DOMAIN}${u.path}`,
      priority: u.priority,
      lastmod: u.path === '/' ? undefined : isoDate(fs.statSync(path.join(DIST_DIR, u.file)).mtimeMs),
    }));

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

  fs.writeFileSync(SITEMAP_PATH, xml, { encoding: 'utf8' }); // BOM 없이
  console.log('🗺️ sitemap.xml 생성 완료! →', SITEMAP_PATH);
}

generateSitemap();
