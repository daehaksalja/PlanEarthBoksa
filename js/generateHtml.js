// 📁 generateHtml.js
const fs = require('fs-extra');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 📌 Supabase 연결 정보
const SUPABASE_URL = 'https://feprvneoartflrnmefxz.supabase.co';
const SUPABASE_KEY = 'sb_secret_MJU0fw2ANZ4TqNiLuh5kHA_1GuTC48_';
const OUTPUT_DIR = path.join(__dirname, '..', 'dist');


const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 🔧 슬러그 생성 함수 (파일명용)
function slugify(str) {
  return str
    .toLowerCase()
   
    .replace(/[^a-z0-9가-힣\s_-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 🧹 기존 dist 폴더 비우기
async function cleanOutput() {
  try {
    console.log('📂 dist 경로:', OUTPUT_DIR);
    await fs.ensureDir(OUTPUT_DIR);
    console.log('🧹 emptyDir 실행 전');
    await fs.emptyDir(OUTPUT_DIR);
    console.log('🧼 dist 폴더 초기화 완료');
  } catch (err) {
    console.error('❌ dist 초기화 실패:', err.message);
  }
}


// 📄 HTML 정적 페이지 생성
async function generatePages() {
  const { data: works, error } = await supabase.from('works').select('*');
  if (error) throw error;

  const templatePath = path.join(__dirname, '..', 'template.html'); // ✅ 상위 폴더 기준

  const template = fs.readFileSync(templatePath, 'utf-8');
for (const item of works) {
  const slug = `${item.id}-${slugify(item.title)}`;
  const html = template
    .replace(/{{id}}/g, item.id)
    .replace(/{{title}}/g, item.title || '')
    .replace(/{{subtitle}}/g, item.subtitle || '')
    .replace(/{{image_url}}/g, item.image_url || '')
    .replace(/{{since}}/g, item.since || '');
console.log('👉 원본 데이터:', item);

  const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
  await fs.writeFile(outputPath, html);
  console.log(`✅ 생성됨: ${slug}.html`);
}

}

// 🏁 실행
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

