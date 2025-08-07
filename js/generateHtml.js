const path = require('path');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const OUTPUT_DIR = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(__dirname, '..', 'template.html');

function slugifyWithPadding(id, subtitle) {
  const paddedId = id.toString().padStart(4, '0');
  const slug = subtitle
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${paddedId}-${slug}`;
}

// ✅ 숫자형 html 파일만 정리
async function cleanOutput() {
  const files = fs.readdirSync(OUTPUT_DIR);
  const regex = /^[0-9]{4}-.+\.html$/;

  for (const file of files) {
    if (regex.test(file)) {
      await fs.unlink(path.join(OUTPUT_DIR, file));
      console.log(`🗑️ 삭제됨: ${file}`);
    }
  }
  console.log('🧹 숫자형 html 파일 정리 완료!');
}

async function generatePages() {
  const { data: works, error } = await supabase.from('works').select('*');
  if (error) throw error;

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  for (const item of works) {
    const slug = slugifyWithPadding(item.id, item.subtitle || item.title);

    const html = template
      .replace(/{{id}}/g, item.id)
      .replace(/{{title}}/g, item.title || '')
      .replace(/{{subtitle}}/g, item.subtitle || '')
      .replace(/{{image_url}}/g, item.image_url || '')
      .replace(/{{since}}/g, item.since || '')
      .replace(/{{slug}}/g, slug); // ✅ 요줄 추가!

    const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
    await fs.writeFile(outputPath, html);
    console.log(`✅ 생성됨: ${slug}.html`);
  }
}

(async () => {
  try {
    await cleanOutput();           // 숫자 슬러그 html만 정리
    await generatePages();         // Supabase에서 HTML 생성
    console.log('🎉 모든 정적 페이지 생성 완료!');

    const { execSync } = require('child_process');
    execSync('node js/generateSitemap.js');
    console.log('🗺️ sitemap.xml 생성 완료!');
  } catch (err) {
    console.error('❌ 오류 발생:', err);
  }
})();
