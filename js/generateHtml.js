// generateHtml.js


require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env') // 강제 경로 지정!
});
console.log('[DEBUG] SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('[DEBUG] SUPABASE_KEY:', process.env.SUPABASE_KEY?.slice(0, 10) + '...'); // 일부만
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');
const AWS = require('aws-sdk');

// ✅ 환경변수 기반 초기화
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const r2 = new AWS.S3({
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  endpoint: process.env.R2_ENDPOINT,
  signatureVersion: 'v4',
  region: 'auto',
});

const OUTPUT_DIR = path.join(__dirname, '..', 'dist');
  // /tmp/dist

// 🧹 dist 폴더 초기화
async function prepareOutputDir() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`${OUTPUT_DIR} 폴더가 생성되었거나 이미 존재합니다.`);
}

async function cleanOutput() {
  await fs.ensureDir(OUTPUT_DIR);
  await fs.emptyDir(OUTPUT_DIR);
  console.log('🧼 임시 dist 폴더 초기화 완료:', OUTPUT_DIR);
}

// 📄 정적 페이지 생성
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

// 🚀 전체 실행
(async () => {
  try {
    await prepareOutputDir();
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

// 🔤 슬러그 변환 함수
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s_-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
