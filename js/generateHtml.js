// generateHtml.js 최상단
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');

// OUTPUT_DIR을 OS 임시 디렉토리 아래로 변경
const OUTPUT_DIR = path.join(os.tmpdir(), 'dist');  // 예: /tmp/dist

const SUPABASE_URL = 'https://feprvneoartflrnmefxz.supabase.co';
const SUPABASE_KEY = 'sb_secret_MJU0fw2ANZ4TqNiLuh5kHA_1GuTC48_';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
async function prepareOutputDir() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`${OUTPUT_DIR} 폴더가 생성되었거나 이미 존재합니다.`);
}

prepareOutputDir();
async function cleanOutput() {
  await fs.ensureDir(OUTPUT_DIR);
  await fs.emptyDir(OUTPUT_DIR);
  console.log('🧼 임시 dist 폴더 초기화 완료:', OUTPUT_DIR);
}

async function generatePages() {
  const { data: works, error } = await supabase.from('works').select('*');
  if (error) throw error;

  const templatePath = path.join(__dirname, '..', 'template.html');
  const template = fs.readFileSync(templatePath, 'utf-8');

  for (const item of works) {
    const slug = `${item.id}-${slugify(item.title)}`;
    const html = template
      .replace(/{{id}}/g, item.id)
      .replace(/{{title}}/g, item.title || '')
      .replace(/{{subtitle}}/g, item.subtitle || '')
      .replace(/{{image_url}}/g, item.image_url || '')
      .replace(/{{since}}/g, item.since || '');

    const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
    await fs.writeFile(outputPath, html);
    console.log(`✅ 생성됨: ${slug}.html`);
  }
}

// 나머지 코드 동일
(async () => {
  try {
    await cleanOutput();
    await generatePages();
    console.log('🎉 모든 정적 페이지 생성 완료!');

    const { execSync } = require('child_process');
    execSync('node js/generateSitemap.js');
    console.log('🗺️ sitemap.xml 생성 완료!');
  } catch (err) {
    console.error('❌ 오류 발생:', err);
  }
})();

// 슬러그 생성 함수도 기존대로 유지
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s_-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
